import '../utils/timezone';
import 'dotenv/config';
import { spawn } from 'child_process';
import { mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import connection from '../connection';
import {
  comoCorrecao,
  extrairJson,
  filaDeGeracao,
  filaDoTema,
  guardarDevocional,
  montarPrompt,
  respostaDoModelo,
  type ResenhaParaDevocional,
} from '../services/devocional';
import { MESES } from '../services/curadoriaDoLivro';
import { logError, logInfo, logSuccess, logWarning } from '../utils/logger';
import { urlDoProxy } from '../utils/proxy';
import {
  escrever as escreverPorApi,
  provedoresDoAmbiente,
  type Provedor,
} from '../services/provedores';

/**
 * Escreve os devocionais.
 *
 *     npm run devocionais                    # 5, das mais recentes
 *     npm run devocionais -- 20              # 20, das mais recentes
 *     npm run devocionais -- 20 2027-6       # 20 para o mês de Escatologia
 *     npm run devocionais -- 20 2027-6 --listar   # só a lista, sem gastar cota
 *     npm run devocionais -- 20 --todos      # abre para todos os pregadores
 *     npm run devocionais -- 20 --cli        # força o Claude, ignorando as chaves
 *
 * **Dois motores.** Com `GROQ_API_KEYS` ou `NVIDIA_API_KEYS` no ambiente, usa a
 * API — modelos abertos, de graça, com rodízio de chaves. Sem chave nenhuma,
 * cai no CLI do Claude, que consome a assinatura de quem roda e rende ~18
 * devocionais por janela de 5 horas.
 *
 * O motor não muda mais nada: prompt, validação, retentativa e gravação são os
 * mesmos, e quem decide se o texto presta é o Zod. `modelo` fica gravado em
 * cada devocional, então dá para comparar os dois depois.
 *
 * **Só pregação do Nélio, por padrão** — o livro é dele. Ver
 * `PREGADOR_DO_LIVRO`.
 *
 * A fila são as resenhas sem devocional. Interromper no meio não perde nada:
 * cada uma é gravada assim que fica pronta, e a execução seguinte continua de
 * onde parou.
 *
 * **Com um mês, a fila muda de critério**: em vez das mais recentes, as que
 * mais se parecem com o tema. É o modo que vale a pena — a cota rende cerca de
 * 18 devocionais por janela, e gastá-la escrevendo texto que nenhum mês do
 * livro vai usar é o desperdício que este parâmetro existe para evitar.
 */

const MODELO = 'claude-opus-5';
const LOTE_PADRAO = 5;

/**
 * De quem é o livro.
 *
 * Não é preferência de quem roda o script: **o livro é do pastor Nélio**, e
 * devocional escrito a partir da pregação de outra pessoa não pertence a ele.
 * Por isso o filtro é o padrão e não uma flag — depender de alguém lembrar de
 * digitar `--pregador` significa que uma distração contamina o acervo do
 * livro, e o erro só apareceria na diagramação.
 *
 * `--todos` desliga, para geração que não seja para este livro.
 */
const PREGADOR_DO_LIVRO = 'Nélio Monteiro';
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

    // Sem isto, `saida += pedaco` converte cada chunk em string por conta
    // própria, e um caractere multi-byte partido na fronteira entre dois
    // chunks vira "�": "século" saiu "s�culo" e a referência "2 Coríntios"
    // deixou de casar com a ACF. O setEncoding segura o byte pela metade até
    // o chunk seguinte completar o caractere.
    processo.stdout.setEncoding('utf8');
    processo.stderr.setEncoding('utf8');

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

/**
 * Quantas vezes pedir o mesmo devocional.
 *
 * A geração é estocástica: a reflexão estoura os 1050 caracteres de vez em
 * quando, e o mesmo pedido repetido costuma passar. Sem retentativa, o item
 * voltava para a fila e alguém precisava rodar de novo na mão — foi o que
 * aconteceu com `2 Coríntios 1:8-11` em Agosto.
 *
 * Duas, não mais: se o texto continua estourando na segunda, o problema é a
 * resenha, não o acaso, e insistir só queima cota.
 */
const TENTATIVAS = 2;

/**
 * Quem escreve o texto: o CLI do Claude ou uma API aberta.
 *
 * O CLI consome a assinatura de quem roda — ~18 devocionais por janela de 5
 * horas. Groq e NVIDIA servem modelos abertos de graça, com limite **por
 * chave**, então várias chaves em rodízio viram várias cotas.
 *
 * O motor não muda mais nada: prompt, validação, retentativa e gravação são os
 * mesmos. Quem decide se o texto presta é o Zod, não o provedor.
 */
type Motor = { nome: string; escrever(prompt: string): Promise<{ texto: string; gasto: Gasto }> };

function motorDoClaude(): Motor {
  return {
    nome: `CLI ${MODELO}`,
    escrever: pedirAoClaude,
  };
}

function motorDeApi(provedores: Provedor[]): Motor {
  return {
    nome: provedores.map((p) => `${p.nome}/${p.modelo} (${p.chaves.length} chaves)`).join(' → '),
    async escrever(prompt: string) {
      const r = await escreverPorApi(provedores, prompt);
      return { texto: r.texto, gasto: { entrada: r.entrada, saida: r.saida } };
    },
  };
}

async function gerarUm(resenha: ResenhaParaDevocional, motor: Motor): Promise<Gasto> {
  const gasto: Gasto = { entrada: 0, saida: 0 };
  let recusa: unknown;

  for (let tentativa = 1; tentativa <= TENTATIVAS; tentativa++) {
    // A correção só existe da segunda em diante: repetir o prompt intacto
    // depois de uma recusa por tamanho tende a produzir a mesma recusa.
    const correcao = tentativa === 1 ? undefined : comoCorrecao(recusa);

    // Erro do motor (cota, proxy, rede) sobe daqui e não é retentado: nenhuma
    // repetição resolveria, e o lote tem seu próprio tratamento para isso.
    const { texto, gasto: custo } = await motor.escrever(montarPrompt(resenha, correcao));
    gasto.entrada += custo.entrada;
    gasto.saida += custo.saida;

    try {
      const resposta = respostaDoModelo.parse(extrairJson(texto));
      const devocional = await guardarDevocional(resenha.id, resposta, motor.nome);

      logSuccess(`"${devocional.titulo}" — ${devocional.referencia}`, 'devocional');
      if (!devocional.versiculo) {
        logWarning(`referência "${devocional.referencia}" não resolveu na ACF`, 'devocional');
      }

      return gasto;
    } catch (e) {
      recusa = e;
      if (tentativa < TENTATIVAS) {
        logWarning(`resposta recusada, tentando de novo (${tentativa}/${TENTATIVAS})`, 'devocional');
      }
    }
  }

  throw recusa;
}

/**
 * Resolve `2027-6` no tema daquele mês. Aceita também o uuid direto, que é o
 * que a API devolve.
 */
async function acharTema(argumento: string) {
  const anoMes = argumento.match(/^(\d{4})-(\d{1,2})$/);

  const tema = anoMes
    ? await connection.temaMes.findUnique({
        where: { ano_mes: { ano: Number(anoMes[1]), mes: Number(anoMes[2]) } },
        select: { id: true, ano: true, mes: true, tema: true },
      })
    : await connection.temaMes.findUnique({
        where: { id: argumento },
        select: { id: true, ano: true, mes: true, tema: true },
      });

  if (!tema) {
    throw new Error(
      `Nenhum tema em "${argumento}". Use ano-mês, como 2027-6, ` +
        `e rode \`npm run seed:temas -- 2027\` se o ano ainda não foi semeado.`,
    );
  }

  return tema;
}

/**
 * O pregador pedido em `--pregador "Nélio Monteiro"`, resolvido pelo nome
 * canônico ou por qualquer um dos aliases.
 */
async function acharPregador(nome: string) {
  const alvo = nome.toLowerCase();

  const pregador = await connection.pregador.findFirst({
    where: {
      OR: [{ nomeCanonico: { equals: nome, mode: 'insensitive' } }, { aliases: { has: alvo } }],
    },
    select: { id: true, nomeCanonico: true },
  });

  if (!pregador) throw new Error(`Pregador "${nome}" não está no cadastro`);
  return pregador;
}

async function main() {
  const limite = Number(process.argv[2]) || LOTE_PADRAO;
  const alvo = process.argv[3]?.startsWith('--') ? undefined : process.argv[3];

  // O pregador é padrão, não opção: esquecer a flag uma vez colocaria pregação
  // de outra pessoa dentro do livro do Nélio. `--todos` abre para o acervo
  // inteiro, para quando a geração não for para este livro.
  const pedido = process.argv.indexOf('--pregador');
  const pregador = process.argv.includes('--todos')
    ? null
    : await acharPregador(pedido > -1 ? (process.argv[pedido + 1] ?? '') : PREGADOR_DO_LIVRO);

  // Motor: API se houver chave configurada, CLI caso contrário. `--cli` força
  // o Claude mesmo com chaves no ambiente, para comparar os dois lado a lado.
  const provedores = provedoresDoAmbiente();
  const motor =
    provedores.length > 0 && !process.argv.includes('--cli')
      ? motorDeApi(provedores)
      : motorDoClaude();
  logInfo(`motor: ${motor.nome}`, 'devocional');

  const pendentes = await connection.resenha.count({ where: { devocional: null } });
  logInfo(`${pendentes} resenhas ainda sem devocional; gerando ${Math.min(limite, pendentes)}`, 'devocional');

  let fila;
  if (alvo) {
    const tema = await acharTema(alvo);
    fila = (await filaDoTema(tema.id, limite, pregador?.id)).fila;
    logInfo(
      `por afinidade com ${MESES[tema.mes - 1]}/${tema.ano} — "${tema.tema}"` +
        (pregador ? `, só de ${pregador.nomeCanonico}` : ''),
      'devocional',
    );
  } else {
    fila = await filaDeGeracao(limite, pregador?.id);
    logInfo(`das mais recentes${pregador ? `, só de ${pregador.nomeCanonico}` : ''}`, 'devocional');
  }

  // Conferir antes de gastar: 20 devocionais são ~560k tokens de entrada, mais
  // do que cabe numa janela da assinatura. Ver a lista custa zero.
  if (process.argv.includes('--listar')) {
    for (const [i, r] of fila.entries()) {
      logInfo(`${String(i + 1).padStart(3)}. ${r.titulo}`, 'devocional');
    }
    logSuccess(`${fila.length} na fila — nada gerado, isto foi só a lista`, 'devocional');
    return;
  }
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
      const gasto = await gerarUm(resenha, motor);
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
