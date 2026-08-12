import connection from '../connection';
import type { NaturezaEvento, Turno } from '../generated/prisma/enums';
import { NotFoundError, ValidationError } from '../utils/logger';
import { chave, resolverPregador } from './pregadores';

/**
 * Correção manual das resenhas que a ingestão não conseguiu completar.
 *
 * O parser nunca inventa: quando o texto não diz quem pregou ou em que dia,
 * o campo fica null. São 40 sem pregador e 297 sem data, e é aqui que uma
 * pessoa preenche o que só ela sabe.
 */

export type FiltroPendentes = {
  semPregador?: boolean;
  semData?: boolean;
  ano?: number;
  pagina?: number;
  porPagina?: number;
};

const POR_PAGINA_PADRAO = 20;
const POR_PAGINA_MAXIMO = 100;

/**
 * Lista o que falta revisar.
 *
 * Sem filtro, devolve tudo que tem alguma lacuna — falta pregador OU data.
 * Com `semPregador` e `semData` juntos, devolve só as que têm as duas.
 */
export async function listarPendentes(filtro: FiltroPendentes) {
  const porPagina = Math.min(filtro.porPagina ?? POR_PAGINA_PADRAO, POR_PAGINA_MAXIMO);
  const pagina = Math.max(filtro.pagina ?? 1, 1);

  const lacunas: Array<Record<string, null>> = [];
  if (filtro.semPregador) lacunas.push({ pregadorId: null });
  if (filtro.semData) lacunas.push({ dataPregacao: null });

  const where = {
    ...(filtro.ano ? { ano: filtro.ano } : {}),
    // Sem filtro explícito, "pendente" é ter qualquer uma das lacunas.
    ...(lacunas.length === 0
      ? { OR: [{ pregadorId: null }, { dataPregacao: null }] }
      : lacunas.length === 1
        ? lacunas[0]
        : { AND: lacunas }),
  };

  const [total, resenhas] = await Promise.all([
    connection.resenha.count({ where }),
    connection.resenha.findMany({
      where,
      orderBy: [{ publicadoEm: 'desc' }],
      skip: (pagina - 1) * porPagina,
      take: porPagina,
      select: {
        id: true,
        slug: true,
        titulo: true,
        urlBlog: true,
        publicadoEm: true,
        dataPregacao: true,
        origemData: true,
        ano: true,
        pregadorBruto: true,
        textoBase: true,
        pregador: { select: { id: true, nomeCanonico: true } },
        culto: { select: { id: true, data: true, turno: true, natureza: true } },
      },
    }),
  ]);

  return {
    total,
    pagina,
    porPagina,
    paginas: Math.ceil(total / porPagina),
    resenhas,
  };
}

export type CorrecaoResenha = {
  /** Id de um pregador já cadastrado. */
  pregadorId?: string;
  /** Nome de quem pregou. Resolvido pelos aliases do cadastro. */
  pregadorNome?: string;
  /**
   * Autoriza cadastrar quem não está no cadastro.
   *
   * Sem isto, nome que não resolve é recusado com sugestões. Um erro de
   * digitação numa correção manual não pode inventar pregador — é o mesmo
   * defeito que enchia o banco de "Deus" e "Nélio Monteiro Noite".
   */
  criarSeNaoExistir?: boolean;
  /** Data do encontro, em ISO (AAAA-MM-DD). */
  dataPregacao?: string;
  turno?: Turno;
  natureza?: NaturezaEvento;
};

/**
 * Aplica uma correção manual.
 *
 * O que vem daqui é marcado como MANUAL, para não se confundir com o que foi
 * extraído do texto: a análise pode separar o que a igreja confirmou do que o
 * parser deduziu.
 */
export async function corrigirResenha(id: string, correcao: CorrecaoResenha) {
  const resenha = await connection.resenha.findUnique({
    where: { id },
    select: { id: true, dataPregacao: true, culto: true },
  });
  if (!resenha) throw new NotFoundError(`Resenha ${id} não encontrada`);

  if (correcao.pregadorId && correcao.pregadorNome) {
    throw new ValidationError('Informe pregadorId ou pregadorNome, não os dois', [
      { campo: 'pregadorNome', mensagem: 'conflita com pregadorId' },
    ]);
  }

  const dados: Record<string, unknown> = {};

  if (correcao.pregadorId) {
    const existe = await connection.pregador.findUnique({
      where: { id: correcao.pregadorId },
      select: { id: true },
    });
    if (!existe) throw new NotFoundError(`Pregador ${correcao.pregadorId} não encontrado`);

    dados.pregadorId = existe.id;
    dados.pregadorOrigem = 'MANUAL';
  }

  if (correcao.pregadorNome) {
    const pregador = await resolverOuCadastrar(
      correcao.pregadorNome,
      correcao.criarSeNaoExistir ?? false,
    );
    dados.pregadorId = pregador.id;
    dados.pregadorBruto = correcao.pregadorNome;
    dados.pregadorOrigem = 'MANUAL';
  }

  if (correcao.dataPregacao) {
    const data = new Date(`${correcao.dataPregacao}T00:00:00Z`);
    dados.dataPregacao = data;
    dados.origemData = 'MANUAL';
    dados.ano = data.getUTCFullYear();
  }

  // O culto é reconstruído quando a data, o turno ou a natureza mudam: são os
  // três campos que o identificam.
  const dataFinal = correcao.dataPregacao
    ? new Date(`${correcao.dataPregacao}T00:00:00Z`)
    : resenha.dataPregacao;
  const turnoFinal = correcao.turno ?? resenha.culto?.turno ?? null;
  const naturezaFinal = correcao.natureza ?? resenha.culto?.natureza ?? 'CULTO';

  if (dataFinal && turnoFinal) {
    const culto = await connection.culto.upsert({
      where: {
        data_turno_natureza: { data: dataFinal, turno: turnoFinal, natureza: naturezaFinal },
      },
      update: {},
      create: { data: dataFinal, turno: turnoFinal, natureza: naturezaFinal },
      select: { id: true },
    });
    dados.cultoId = culto.id;
  }

  if (Object.keys(dados).length === 0) {
    throw new ValidationError('Nada para corrigir', [
      { campo: 'corpo', mensagem: 'informe ao menos um campo' },
    ]);
  }

  return connection.resenha.update({
    where: { id },
    data: dados,
    select: {
      id: true,
      titulo: true,
      dataPregacao: true,
      origemData: true,
      pregadorBruto: true,
      pregadorOrigem: true,
      pregador: { select: { id: true, nomeCanonico: true } },
      culto: { select: { id: true, data: true, turno: true, natureza: true } },
    },
  });
}

/**
 * Encontra o pregador pelo nome.
 *
 * Passa pela mesma resolução por alias da ingestão, então digitar "Nélio" numa
 * correção aponta para Nélio Monteiro em vez de criar um homônimo.
 *
 * Nome que não resolve é recusado, com sugestões de quem se parece. Cadastrar
 * gente nova exige `criarSeNaoExistir`, para que seja uma decisão e não o
 * efeito colateral de um erro de digitação.
 */
async function resolverOuCadastrar(nome: string, podeCriar: boolean) {
  const conhecidos = await connection.pregador.findMany({
    select: { id: true, nomeCanonico: true, aliases: true },
  });

  const encontrado = resolverPregador(nome, conhecidos);
  if (encontrado) return encontrado;

  if (!podeCriar) {
    throw new ValidationError(`"${nome}" não está no cadastro de pregadores`, [
      {
        campo: 'pregadorNome',
        mensagem: sugerir(nome, conhecidos.map((p) => p.nomeCanonico)),
      },
    ]);
  }

  return connection.pregador.create({
    data: { nomeCanonico: nome.trim(), tipo: 'CONVIDADO', aliases: [chave(nome)] },
    select: { id: true, nomeCanonico: true, aliases: true },
  });
}

/** Nomes que começam igual — costuma ser o que a pessoa quis digitar. */
function sugerir(nome: string, cadastrados: string[]): string {
  const inicio = chave(nome).slice(0, 4);
  const parecidos = cadastrados
    .filter((c) => chave(c).startsWith(inicio))
    .slice(0, 5);

  return parecidos.length > 0
    ? `você quis dizer: ${parecidos.join(', ')}? Se for alguém novo, envie criarSeNaoExistir: true`
    : 'confira a grafia. Se for alguém novo, envie criarSeNaoExistir: true';
}
