import '../utils/timezone';
import 'dotenv/config';
import { spawn } from 'child_process';
import { mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import connection from '../connection';
import {
  extrairJson,
  filaDeGeracao,
  guardarDevocional,
  montarPrompt,
  respostaDoModelo,
  type ResenhaParaDevocional,
} from '../services/devocional';
import { logError, logInfo, logSuccess, logWarning } from '../utils/logger';
import { urlDoProxy } from '../utils/proxy';

/**
 * Escreve os devocionais chamando o Claude Opus pelo CLI local.
 *
 * Usa a assinatura, não a chave de API. Por isso é um script de lote rodado à
 * mão, e não algo que a API dispara: quem controla o gasto é você.
 *
 *     npm run devocionais           # 5 resenhas
 *     npm run devocionais -- 20     # 20 resenhas
 *
 * A fila são as resenhas sem devocional. Interromper no meio não perde nada:
 * cada uma é gravada assim que fica pronta, e a execução seguinte continua de
 * onde parou.
 */

const MODELO = 'claude-opus-5';
const LOTE_PADRAO = 5;
/**
 * Quantas falhas seguidas derrubam o lote.
 *
 * Falha isolada é normal — o modelo devolve um texto longo demais e o Zod
 * recusa. Falha atrás de falha é outra coisa: conta sem uso disponível, sessão
 * do CLI expirada, rede fora. Nesses casos o lote inteiro falharia igual, e um
 * lote de mil itens levaria horas para descobrir isso.
 */
const FALHAS_SEGUIDAS_PARA_ABORTAR = 3;
/** Uma resenha longa com um devocional inteiro de volta leva bem mais que o padrão. */
const TEMPO_LIMITE_MS = 5 * 60 * 1000;

/**
 * O CLI carrega o CLAUDE.md do diretório onde roda. Aqui isso seria desperdício
 * de contexto e ainda arriscaria misturar as instruções do projeto com as do
 * devocional — então ele roda de uma pasta vazia.
 */
const PASTA_NEUTRA = mkdtempSync(join(tmpdir(), 'devocional-'));

/**
 * O ambiente do CLI, com o proxy corporativo repassado.
 *
 * `aplicarProxy()` não serve aqui: ele troca o dispatcher do undici, que vale
 * só para o `fetch` deste processo. O `claude` é outro processo e sai pela rede
 * por conta própria — lê `HTTPS_PROXY` do ambiente e nada mais.
 *
 * Sem isso o comportamento depende de onde o script foi chamado: num terminal
 * que já tenha a variável exportada funciona, num terminal limpo o CLI volta
 * 407 em poucos segundos, com o erro no stdout e o stderr vazio. Foi
 * exatamente esse o sintoma que custou um lote inteiro.
 *
 * Aqui a URL leva a senha percent-encoded, ao contrário do header Basic do
 * undici: é a forma `http://user:pass@host:porta` que o CLI espera.
 */
function ambienteDoCli(): NodeJS.ProcessEnv {
  const proxy = urlDoProxy();
  if (!proxy) return process.env;

  return { ...process.env, HTTP_PROXY: proxy, HTTPS_PROXY: proxy };
}

/**
 * O que de fato deu errado, em uma linha legível.
 *
 * O CLI descreve a falha no **stdout**, num envelope JSON, e deixa o stderr
 * vazio — ler só o stderr produzia `CLI saiu com código 1:` e mais nada. E o
 * envelope é longo: truncar o começo mostra `is_error`, `session_id` e
 * contadores zerados, nunca a frase que explica o motivo. Ela vive no campo
 * `result`, lá no fim.
 */
function motivoDaFalha(saida: string, erro: string): string {
  try {
    const envelope = JSON.parse(saida) as { result?: string; error?: string };
    const texto = envelope.result || envelope.error;
    if (texto) return texto.slice(0, 400);
  } catch {
    // Não era JSON — cai para a saída crua.
  }

  return [erro.trim(), saida.trim()].filter(Boolean).join(' | ').slice(0, 400) || '(sem mensagem)';
}

/**
 * Os argumentos do CLI.
 *
 * `--strict-mcp-config` sem nenhum `--mcp-config` desliga **todos** os MCP.
 * Não é detalhe: a pasta neutra evita o CLAUDE.md do projeto, mas as settings
 * do usuário continuam valendo, e com elas entram firecrawl, playwright e
 * context7 — dezenas de definições de ferramenta, reenviadas a cada chamada.
 *
 * Escrever devocional não usa ferramenta nenhuma. Medido numa chamada com os
 * MCP ligados: ~30k tokens de entrada, dos quais só ~3k eram o nosso prompt.
 * O resto era catálogo de ferramenta que o modelo jamais usaria.
 */
const ARGUMENTOS = [
  '-p',
  '--output-format',
  'json',
  '--model',
  MODELO,
  '--strict-mcp-config',
];

/** O que uma chamada custou, para somar no fim do lote. */
type Gasto = { entrada: number; saida: number };

/**
 * O prompt vai pelo stdin, não como argumento.
 *
 * Passar um texto de milhares de caracteres, com quebras de linha e aspas, na
 * linha de comando do Windows não sobrevive: o CLI recebia vazio e respondia
 * "Fala. Que precisa?". Pelo stdin não há o que escapar.
 */
function pedirAoClaude(prompt: string): Promise<{ texto: string; gasto: Gasto }> {
  return new Promise((resolver, rejeitar) => {
    const processo = spawn('claude', ARGUMENTOS, {
      cwd: PASTA_NEUTRA,
      env: ambienteDoCli(),
      shell: true,
      timeout: TEMPO_LIMITE_MS,
    });

    let saida = '';
    let erro = '';
    processo.stdout.on('data', (pedaco) => (saida += pedaco));
    processo.stderr.on('data', (pedaco) => (erro += pedaco));

    processo.on('error', rejeitar);
    processo.on('close', (codigo) => {
      if (codigo !== 0) {
        return rejeitar(new Error(`CLI saiu com código ${codigo}: ${motivoDaFalha(saida, erro)}`));
      }

      try {
        const envelope = JSON.parse(saida) as {
          is_error?: boolean;
          result?: string;
          usage?: {
            input_tokens?: number;
            cache_creation_input_tokens?: number;
            cache_read_input_tokens?: number;
            output_tokens?: number;
          };
        };
        if (envelope.is_error || !envelope.result) {
          return rejeitar(new Error(`CLI devolveu erro: ${motivoDaFalha(saida, erro)}`));
        }

        const u = envelope.usage ?? {};
        resolver({
          texto: envelope.result,
          gasto: {
            // Cache criado e cache lido contam: os dois são entrada, e é a
            // soma que consome a cota da assinatura.
            entrada:
              (u.input_tokens ?? 0) +
              (u.cache_creation_input_tokens ?? 0) +
              (u.cache_read_input_tokens ?? 0),
            saida: u.output_tokens ?? 0,
          },
        });
      } catch (e) {
        rejeitar(new Error(`resposta do CLI não é JSON: ${saida.slice(0, 200)}`));
      }
    });

    processo.stdin.write(prompt);
    processo.stdin.end();
  });
}

/**
 * Reconhece o fim da cota da assinatura.
 *
 * A mensagem vem em inglês, do próprio CLI, e traz a hora do reset:
 * `You've hit your session limit · resets 12:30pm (America/Sao_Paulo)`.
 *
 * Isso não é falha de um item: nenhum dos seguintes vai passar. Insistir só
 * gasta tempo, então o lote para na primeira, sem esperar as três seguidas.
 */
function eLimiteDaConta(motivo: string): boolean {
  return /\b(session|usage|rate) limit\b/i.test(motivo);
}

async function gerarUm(resenha: ResenhaParaDevocional): Promise<Gasto> {
  const { texto, gasto } = await pedirAoClaude(montarPrompt(resenha));
  const resposta = respostaDoModelo.parse(extrairJson(texto));
  const devocional = await guardarDevocional(resenha.id, resposta, MODELO);

  logSuccess(`"${devocional.titulo}" — ${devocional.referencia}`, 'devocional');
  if (!devocional.versiculo) {
    logWarning(`referência "${devocional.referencia}" não resolveu na ACF`, 'devocional');
  }

  return gasto;
}

async function main() {
  const limite = Number(process.argv[2]) || LOTE_PADRAO;

  const pendentes = await connection.resenha.count({ where: { devocional: null } });
  logInfo(`${pendentes} resenhas ainda sem devocional; gerando ${Math.min(limite, pendentes)}`, 'devocional');

  const fila = await filaDeGeracao(limite);
  let feitos = 0;
  let seguidas = 0;
  let entrada = 0;
  let saidaTokens = 0;
  const falhas: string[] = [];

  for (const [i, item] of fila.entries()) {
    const resenha: ResenhaParaDevocional = {
      id: item.id,
      titulo: item.titulo,
      conteudoLimpo: item.conteudoLimpo,
      textoBase: item.textoBase,
      pregador: item.pregador?.nomeCanonico ?? null,
      doutrina: item.classificacoes[0]?.doutrina.nome ?? null,
    };

    logInfo(`[${i + 1}/${fila.length}] ${resenha.titulo.slice(0, 55)}`, 'devocional');

    try {
      const gasto = await gerarUm(resenha);
      entrada += gasto.entrada;
      saidaTokens += gasto.saida;
      feitos++;
      seguidas = 0;
    } catch (e) {
      // Uma falha não derruba o lote: o resto continua, e esta volta na
      // próxima execução, porque a fila é "resenha sem devocional".
      const motivo = (e as Error).message.slice(0, 400);
      falhas.push(`${resenha.titulo.slice(0, 40)}: ${motivo}`);
      seguidas++;

      // Na hora, não só no fim: guardar o motivo para o resumo final já custou
      // um lote inteiro rodando às cegas com a conta sem uso disponível.
      logWarning(`falhou: ${motivo}`, 'devocional');

      if (eLimiteDaConta(motivo)) {
        logError(
          `cota da assinatura esgotada — o lote parou aqui. ` +
            `Os ${feitos} já gravados ficam; a fila retoma sozinha depois do reset.`,
          'devocional',
        );
        break;
      }

      if (seguidas >= FALHAS_SEGUIDAS_PARA_ABORTAR) {
        logError(
          `${seguidas} falhas seguidas — o lote parou. Confira a conta do CLI ` +
            `(\`claude\` na mão) antes de rodar de novo; nada do que já foi gravado se perde.`,
          'devocional',
        );
        break;
      }
    }
  }

  logSuccess(`${feitos} devocionais escritos`, 'devocional');

  // O que decide quantos cabem numa janela da assinatura é o custo por
  // devocional, não o número de itens. Sem medir, não dá para planejar o lote.
  if (feitos > 0) {
    const porItem = Math.round(entrada / feitos);
    logInfo(
      `${entrada.toLocaleString('pt-BR')} tokens de entrada e ` +
        `${saidaTokens.toLocaleString('pt-BR')} de saída — ` +
        `${porItem.toLocaleString('pt-BR')} de entrada por devocional`,
      'devocional',
    );
  }

  if (falhas.length > 0) {
    logWarning(`${falhas.length} falharam e voltam na próxima execução`, 'devocional', falhas);
  }
}

main()
  .catch((e) => {
    logError((e as Error).message, 'devocional');
    process.exit(1);
  })
  .finally(() => connection.$disconnect());
