import '../utils/timezone';
import 'dotenv/config';
import { mkdirSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import connection from '../connection';
import {
  buscarVersiculo,
  comoCorrecao,
  exemplosParecidos,
  extrairJson,
  montarPrompt,
  respostaDoModelo,
  type ResenhaParaDevocional,
} from '../services/devocional';
import { escrever, provedoresDoAmbiente } from '../services/provedores';
import { comoDocumento, semelhanca } from '../services/vetores';
import { logError, logInfo, logSuccess } from '../utils/logger';

/**
 * Qual modelo aberto chega mais perto do Opus.
 *
 *     npm run comparar                       # 3 resenhas, os candidatos padrão
 *     npm run comparar -- 5                  # 5 resenhas
 *     npm run comparar -- 3 openai/gpt-oss-120b,qwen/qwen3.6-27b
 *
 * **Não gasta assinatura e não grava nada.** O gabarito são os devocionais que
 * o Opus já escreveu e estão no banco: as mesmas resenhas são reescritas pelos
 * modelos abertos, que são de graça, e o resultado é comparado com o que já
 * existe. Nenhuma chamada ao CLI do Claude, nenhum `devocional.create`.
 *
 * Sem isso a escolha de modelo seria opinião. Com isso é medida — e refazível
 * quando os provedores trocarem de catálogo, que é o que aconteceu com o
 * `llama-3.3-70b-versatile` da decisão original.
 */

const QUANTAS_PADRAO = 3;

/**
 * Os candidatos. Groq e NVIDIA misturados de propósito: o comparador tenta o
 * modelo em todos os provedores configurados e usa o que atender.
 *
 * A escolha saiu do catálogo real das duas contas, filtrando o que não serve
 * para prosa em português (código, visão, tradução, segurança, embedding).
 */
const CANDIDATOS = [
  // Groq
  'openai/gpt-oss-120b',
  'openai/gpt-oss-20b',
  'qwen/qwen3.6-27b',
  // NVIDIA
  'nvidia/nemotron-3-ultra-550b-a55b',
  'nvidia/nemotron-3-super-120b-a12b',
  'nvidia/nemotron-3.5-lightning-30b-a3b',
  'writer/palmyra-creative-122b',
  'z-ai/glm-5.2',
  'minimaxai/minimax-m3',
  'mistralai/mistral-large-2-instruct',
  'mistralai/mistral-nemotron',
  'deepseek-ai/deepseek-v4-flash-0731',
  'google/gemma-4-31b-it',
  'thinkingmachines/inkling',
  // O parente do modelo que foi reprovado na decisão original. Está aqui de
  // propósito: se ele for mal e os outros bem, confirma que o problema era o
  // modelo, e não a ideia de usar API aberta.
  'meta/llama-3.3-70b-instruct',
];

const SAIDA = join('saida', 'comparacao-modelos.md');

type Nota = {
  modelo: string;
  resenha: string;
  /** Passou no Zod que já protege a página impressa. */
  valido: boolean;
  /** Passou já na primeira tentativa, sem precisar da correção. */
  dePrimeira: boolean;
  motivo?: string;
  /** Quanto o texto se parece com o do Opus para a mesma resenha, de 0 a 1. */
  proximidade?: number;
  charsReflexao?: number;
  charsTitulo?: number;
  /** A referência bíblica existe na ACF? Devocional sem versículo sai capenga. */
  referenciaResolve?: boolean;
  segundos: number;
  entrada: number;
  saida: number;
  texto?: string;
};

async function main() {
  const quantas = Number(process.argv[2]) || QUANTAS_PADRAO;
  const modelos = process.argv[3]?.split(',').map((m) => m.trim()) ?? CANDIDATOS;

  const provedores = provedoresDoAmbiente();
  if (provedores.length === 0) {
    throw new Error('Sem GROQ_API_KEYS ou NVIDIA_API_KEYS no .env');
  }

  // `--exemplos` troca o exemplo fixo do prompt pelos devocionais nossos mais
  // parecidos com a resenha. É a variável a medir: mesmo modelo, prompt
  // diferente. Rodar as duas vezes e comparar a tabela responde se buscar
  // exemplo por semelhança paga o que custa em tokens.
  const comExemplos = process.argv.includes('--exemplos');

  // O gabarito: resenhas que o Opus já escreveu. É o que torna a comparação
  // possível sem gastar assinatura nenhuma agora.
  const comGabarito = await connection.resenha.findMany({
    where: { devocional: { isNot: null }, conteudoLimpo: { not: '' } },
    orderBy: { dataPregacao: 'desc' },
    take: quantas,
    select: {
      id: true,
      titulo: true,
      conteudoLimpo: true,
      textoBase: true,
      pregador: { select: { nomeCanonico: true } },
      classificacoes: {
        where: { papel: 'PRINCIPAL' },
        select: { doutrina: { select: { nome: true } } },
      },
      devocional: {
        select: { titulo: true, referencia: true, reflexao: true, pontosAplicacao: true, oracao: true, modelo: true },
      },
    },
  });

  logInfo(`${comGabarito.length} resenhas de gabarito, ${modelos.length} modelos`, 'devocional');
  logInfo(
    `${comGabarito.length * modelos.length} chamadas — nenhuma consome assinatura` +
      (comExemplos ? ', com exemplos por semelhança' : ', com o exemplo fixo'),
    'devocional',
  );

  const notas: Nota[] = [];
  const relatorio: string[] = ['# Comparação de modelos\n'];

  for (const r of comGabarito) {
    const resenha: ResenhaParaDevocional = {
      id: 'comparacao',
      titulo: r.titulo,
      conteudoLimpo: r.conteudoLimpo,
      textoBase: r.textoBase,
      pregador: r.pregador?.nomeCanonico ?? null,
      doutrina: r.classificacoes[0]?.doutrina.nome ?? null,
    };
    // A própria resenha fica de fora dos exemplos: ela tem devocional (é o
    // gabarito), e trazê-lo entregaria a resposta ao modelo.
    const exemplos = comExemplos ? await exemplosParecidos(r.id, 2) : [];
    const prompt = montarPrompt(resenha, undefined, exemplos);

    const gabarito = r.devocional!;
    const vetorDoGabarito = await comoDocumento(
      [gabarito.titulo, gabarito.reflexao, gabarito.oracao].filter(Boolean).join(' '),
    );

    relatorio.push(`\n## ${r.titulo}\n`);
    relatorio.push(`### GABARITO — ${gabarito.modelo}\n`);
    relatorio.push(`**${gabarito.titulo}** — ${gabarito.referencia}\n`);
    relatorio.push(`${gabarito.reflexao}\n`);
    relatorio.push(gabarito.pontosAplicacao.map((p) => `- ${p}`).join('\n'));
    relatorio.push(`\n> ${gabarito.oracao}\n`);

    for (const modelo of modelos) {
      const inicio = Date.now();
      const nota: Nota = {
        modelo,
        resenha: r.titulo,
        valido: false,
        dePrimeira: false,
        segundos: 0,
        entrada: 0,
        saida: 0,
      };

      try {
        // Duas tentativas, como em produção: a segunda leva o motivo da recusa
        // no prompt. Medir só a primeira reprovaria modelo que na prática
        // funciona -- o lote real nunca desiste no primeiro tropeço.
        let analise!: ReturnType<typeof respostaDoModelo.safeParse>;

        for (let tentativa = 1; tentativa <= 2; tentativa++) {
          const corrigido =
            tentativa === 1
              ? prompt
              : montarPrompt(resenha, comoCorrecao(analise.error), exemplos);

          const { texto, entrada, saida } = await escrever(provedores, corrigido, 120_000, modelo);
          nota.entrada += entrada;
          nota.saida += saida;

          try {
            analise = respostaDoModelo.safeParse(extrairJson(texto));
          } catch (e) {
            // Nem JSON era. `safeParse` de `undefined` produz o erro certo
            // para a correção da rodada seguinte.
            analise = respostaDoModelo.safeParse(undefined);
          }

          if (analise.success) {
            nota.dePrimeira = tentativa === 1;
            break;
          }
        }

        if (!analise.success) {
          nota.motivo = analise.error.issues
            .map((i) => `${i.path.join('.')}: ${i.message}`)
            .join('; ')
            .slice(0, 160);
        } else {
          const d = analise.data;
          nota.valido = true;
          nota.charsReflexao = d.reflexao.length;
          nota.charsTitulo = d.titulo.length;
          nota.referenciaResolve = (await buscarVersiculo(d.referencia)) !== null;

          const vetor = await comoDocumento([d.titulo, d.reflexao, d.oracao].join(' '));
          nota.proximidade = semelhanca(vetorDoGabarito, vetor);

          nota.texto = [
            `**${d.titulo}** — ${d.referencia}`,
            '',
            d.reflexao,
            '',
            d.pontosAplicacao.map((p) => `- ${p}`).join('\n'),
            '',
            `> ${d.oracao}`,
          ].join('\n');
        }
      } catch (e) {
        nota.motivo = (e as Error).message.slice(0, 160);
      }

      nota.segundos = (Date.now() - inicio) / 1000;
      notas.push(nota);

      const marca = nota.valido ? '✓' : '✗';
      logInfo(
        `${marca} ${modelo.padEnd(36)} ${nota.segundos.toFixed(1)}s ` +
          (nota.valido
            ? `prox ${nota.proximidade!.toFixed(3)} refl ${nota.charsReflexao}`
            : nota.motivo),
        'devocional',
      );

      relatorio.push(`\n### ${modelo}${nota.valido ? '' : ' — RECUSADO'}\n`);
      relatorio.push(nota.valido ? nota.texto! : `\`${nota.motivo}\`\n`);
    }
  }

  // ── Resumo ────────────────────────────────────────────────────────────────
  const porModelo = modelos.map((modelo) => {
    const minhas = notas.filter((n) => n.modelo === modelo);
    const validas = minhas.filter((n) => n.valido);
    const media = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

    return {
      modelo,
      aprovados: `${validas.length}/${minhas.length}`,
      dePrimeira: `${validas.filter((n) => n.dePrimeira).length}/${minhas.length}`,
      proximidade: media(validas.map((n) => n.proximidade!)),
      reflexao: Math.round(media(validas.map((n) => n.charsReflexao!))),
      comVersiculo: validas.filter((n) => n.referenciaResolve).length,
      segundos: media(minhas.map((n) => n.segundos)),
      tokens: Math.round(media(minhas.map((n) => n.entrada + n.saida))),
    };
  });

  porModelo.sort((a, b) => b.proximidade - a.proximidade);

  const tabela = [
    '',
    `| modelo | aprovados | de primeira | proximidade | reflexão | versículo | seg | tokens |`,
    '|---|---|---|---|---|---|---|---|',
    ...porModelo.map(
      (p) =>
        `| ${p.modelo} | ${p.aprovados} | ${p.dePrimeira} | ${p.proximidade.toFixed(3)} | ${p.reflexao} | ` +
        `${p.comVersiculo}/${comGabarito.length} | ${p.segundos.toFixed(1)} | ${p.tokens} |`,
    ),
    '',
  ];

  console.log(tabela.join('\n'));
  relatorio.unshift(tabela.join('\n'));

  mkdirSync(dirname(SAIDA), { recursive: true });
  writeFileSync(SAIDA, relatorio.join('\n'), 'utf8');
  logSuccess(`textos lado a lado em ${SAIDA}`, 'devocional');
  logInfo('proximidade é vetor, não julgamento — leia os textos antes de decidir', 'devocional');
}

main()
  .catch((e) => {
    logError((e as Error).message, 'devocional');
    process.exit(1);
  })
  .finally(() => connection.$disconnect());
