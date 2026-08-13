import { z } from 'zod';
import connection from '../connection';

/**
 * Transforma a resenha de um culto em devocional para o livro.
 *
 * O texto é escrito pelo Claude Opus, chamado pelo CLI local — a assinatura em
 * vez da chave de API. Groq com llama foi testado e descartado: texto fraco.
 *
 * Duas regras que valem mais que a qualidade da prosa:
 *
 * 1. **O versículo nunca é escrito pelo modelo.** Ele indica a referência; o
 *    texto vem da tabela `Versiculo`, que tem a ACF inteira. Modelo citando
 *    Escritura de memória erra palavra, e num livro devocional isso é grave.
 * 2. **O devocional nasce da resenha, não do nada.** O que ele diz tem de ser
 *    o que foi pregado naquele culto, não teologia genérica sobre a passagem.
 */

/** Os blocos da página do livro — ver CONTEXTO/modelo-pagina.jpeg. */
export const respostaDoModelo = z.object({
  titulo: z.string().trim().min(3).max(80),
  /** Referência do versículo em destaque: "Salmos 23:1". */
  referencia: z.string().trim().min(3).max(60),
  /**
   * O teto foi medido na página A5 renderizada, não estimado: com os blocos
   * fixos ocupando 501px dos 695px úteis, sobram 194px para a reflexão, o que
   * dá cerca de 1.250 caracteres. O limite fica abaixo disso para o texto não
   * encostar no rodapé.
   */
  reflexao: z.string().trim().min(200).max(1200),
  pontosAplicacao: z.array(z.string().trim().min(10)).min(3).max(4),
  oracao: z.string().trim().min(50),
});

export type RespostaDoModelo = z.infer<typeof respostaDoModelo>;

export type ResenhaParaDevocional = {
  id: string;
  titulo: string;
  conteudoLimpo: string;
  textoBase: string | null;
  pregador: string | null;
  doutrina: string | null;
};

const ESTILO = `Você escreve devocionais no estilo de A.W. Tozer, em português do Brasil.

O que caracteriza esse estilo:
- Abre pelo peso teológico do texto, não por anedota nem por pergunta retórica.
- Fala com a igreja: "meus irmãos", "nossa vida", segunda pessoa do plural.
- Frases curtas e afirmativas. Exclamação usada de verdade, com moderação.
- Sustenta a afirmação com outra passagem bíblica, citada e referenciada.
- Não modera o que a Escritura afirma nem suaviza contraste doutrinário.
- Nada de linguagem corporativa, autoajuda ou motivacional.`;

/**
 * Monta o pedido.
 *
 * A resenha vai inteira: é dela que o devocional tem de nascer. O modelo não
 * escreve o versículo — só indica a referência, e o texto vem do banco.
 */
export function montarPrompt(resenha: ResenhaParaDevocional): string {
  const contexto = [
    `Título da pregação: ${resenha.titulo}`,
    resenha.textoBase ? `Texto base: ${resenha.textoBase}` : null,
    resenha.pregador ? `Pregador: ${resenha.pregador}` : null,
    resenha.doutrina ? `Doutrina predominante: ${resenha.doutrina}` : null,
  ]
    .filter(Boolean)
    .join('\n');

  return `${ESTILO}

Abaixo está a resenha de uma pregação da Igreja Batista do Parque Safira.
Escreva um devocional para a página de um livro, fiel ao que foi pregado —
não teologia genérica sobre a passagem, mas o que esta mensagem disse.

${contexto}

--- RESENHA ---
${resenha.conteudoLimpo}
--- FIM DA RESENHA ---

Responda SOMENTE com JSON válido, sem cercas de código e sem comentário:

{
  "titulo": "título curto e forte, até 60 caracteres, sem ponto final",
  "referencia": "a referência do versículo que resume a mensagem, ex: Salmos 23:1",
  "reflexao": "2 a 3 parágrafos, 900 a 1100 caracteres NO TOTAL, separados por \\n\\n",
  "pontosAplicacao": ["exatamente 3 aplicações, uma linha curta cada, no imperativo"],
  "oracao": "oração curta, primeira pessoa do PLURAL, 180 a 260 caracteres"
}

Os limites de tamanho são rígidos: tudo isso precisa caber em UMA página A5
impressa, junto com o versículo, o QR code e um espaço para anotações. Texto
mais longo do que o pedido não cabe e será cortado.

A "referencia" deve ser um único versículo ou um trecho curto de um capítulo
só, e precisa existir na Bíblia. Não escreva o texto do versículo: apenas a
referência.`;
}

/** O modelo às vezes embrulha o JSON em cercas, mesmo quando pedimos que não. */
export function extrairJson(saida: string): unknown {
  const semCercas = saida
    .replace(/^[\s\S]*?```(?:json)?\s*/m, (trecho) => (trecho.includes('```') ? '' : trecho))
    .replace(/```[\s\S]*$/m, '')
    .trim();

  const candidato = semCercas.startsWith('{') ? semCercas : saida.slice(saida.indexOf('{'));
  return JSON.parse(candidato);
}

/**
 * Resolve a referência em texto bíblico de verdade, vindo da ACF no banco.
 *
 * Aceita "Salmos 23:1" e "Salmos 23:1-3". Faixa vira um texto só, com os
 * versículos emendados — é como aparece impresso na página.
 */
export async function buscarVersiculo(referencia: string): Promise<string | null> {
  const m = referencia.match(/^\s*(.+?)\s+(\d+)\s*[:.]\s*(\d+)(?:\s*-\s*(\d+))?\s*$/);
  if (!m) return null;

  const [, nomeLivro, capitulo, primeiro, ultimo] = m;
  const alvo = nomeLivro
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s/g, '');

  const livros = await connection.livroBiblico.findMany({ select: { id: true, nome: true } });
  const livro = livros.find(
    (l) =>
      l.nome
        .toLowerCase()
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .replace(/\s/g, '') === alvo,
  );
  if (!livro) return null;

  const versiculos = await connection.versiculo.findMany({
    where: {
      livroId: livro.id,
      capitulo: Number(capitulo),
      numero: { gte: Number(primeiro), lte: Number(ultimo ?? primeiro) },
    },
    orderBy: { numero: 'asc' },
    select: { texto: true },
  });

  return versiculos.length > 0 ? versiculos.map((v) => v.texto).join(' ') : null;
}

/** As resenhas que ainda não viraram devocional. É a fila, e não um status. */
export function filaDeGeracao(limite: number) {
  return connection.resenha.findMany({
    where: { devocional: null, conteudoLimpo: { not: '' } },
    orderBy: [{ dataPregacao: 'desc' }],
    take: limite,
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
    },
  });
}

export async function guardarDevocional(
  resenhaId: string,
  resposta: RespostaDoModelo,
  modelo: string,
) {
  return connection.devocional.create({
    data: {
      resenhaId,
      titulo: resposta.titulo,
      referencia: resposta.referencia,
      // Da ACF no banco, nunca do modelo.
      versiculo: await buscarVersiculo(resposta.referencia),
      reflexao: resposta.reflexao,
      pontosAplicacao: resposta.pontosAplicacao,
      oracao: resposta.oracao,
      modelo,
    },
  });
}
