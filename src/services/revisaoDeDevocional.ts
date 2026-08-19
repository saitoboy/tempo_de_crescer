import { z } from 'zod';
import connection from '../connection';
import { buscarVersiculo, respostaDoModelo } from './devocional';
import { conferirFidelidade, type Suspeita } from './fidelidade';
import { NotFoundError } from '../utils/logger';

/**
 * O outro lado do caderno de revisão.
 *
 * O pastor corrige no papel e alguém digita aqui. Sem isto o caderno vira papel
 * que ninguém consegue transformar em nada — e a trava que protege texto
 * revisado nunca dispararia, porque nada nunca viraria `REVISADO`.
 */

/**
 * O que pode ser corrigido, com as mesmas regras da geração.
 *
 * `respostaDoModelo.partial()` de propósito: os limites de tamanho e a exigência
 * de dois parágrafos não são estilo, são a página A5 impressa. Correção humana
 * que estoure o espaço quebra a diagramação igual — a régua é física, e não
 * muda conforme quem escreve.
 */
export const correcaoDeDevocional = respostaDoModelo
  .partial()
  .extend({
    /**
     * Editar marca `REVISADO`, porque quem digita aqui está transcrevendo a
     * revisão do pastor. `manterStatus` serve ao conserto de digitação, que não
     * é aprovação.
     */
    manterStatus: z.boolean().optional(),
  })
  .refine((c) => Object.keys(c).some((k) => k !== 'manterStatus'), {
    message: 'informe ao menos um campo para corrigir',
  });

export type CorrecaoDeDevocional = z.infer<typeof correcaoDeDevocional>;

export type DevocionalCorrigido = {
  id: string;
  status: 'GERADO' | 'REVISADO';
  /** O que a conferência contra a ACF achou no texto corrigido. Não bloqueia. */
  suspeitas: Suspeita[];
};

export async function corrigirDevocional(
  id: string,
  correcao: CorrecaoDeDevocional,
): Promise<DevocionalCorrigido> {
  const atual = await connection.devocional.findUnique({
    where: { id },
    select: { id: true, referencia: true, reflexao: true, oracao: true },
  });
  if (!atual) throw new NotFoundError(`Devocional ${id} não encontrado`);

  const { manterStatus, ...campos } = correcao;

  // Trocar a referência sem trocar o versículo deixaria a página com o texto
  // de um versículo sob a citação de outro — o mesmo defeito que a geração
  // evita buscando sempre da ACF, nunca do que o modelo escreveu.
  const versiculo =
    campos.referencia && campos.referencia !== atual.referencia
      ? await buscarVersiculo(campos.referencia)
      : undefined;

  const salvo = await connection.devocional.update({
    where: { id },
    data: {
      ...campos,
      ...(versiculo !== undefined ? { versiculo } : {}),
      ...(manterStatus ? {} : { status: 'REVISADO' as const }),
    },
    select: { id: true, status: true, reflexao: true, oracao: true, referencia: true, versiculo: true },
  });

  // Confere o resultado, não o que veio no corpo: a correção pode ter mexido só
  // na oração e deixado uma citação inventada na reflexão.
  const suspeitas = await conferirFidelidade({
    reflexao: salvo.reflexao,
    oracao: salvo.oracao,
    referencia: salvo.referencia,
    versiculoResolvido: salvo.versiculo !== null,
  });

  return { id: salvo.id, status: salvo.status, suspeitas };
}

export type FiltroDeDevocionais = {
  status?: 'GERADO' | 'REVISADO';
  ano?: number;
  semQrcode?: boolean;
  busca?: string;
  pagina: number;
  porPagina: number;
};

/**
 * A lista de revisão.
 *
 * Ordena do mais antigo para o mais novo por data de pregação, que é a ordem em
 * que o caderno sai impresso — para a tela e o papel concordarem.
 */
export async function listarDevocionais(filtro: FiltroDeDevocionais) {
  const where = {
    ...(filtro.status ? { status: filtro.status } : {}),
    ...(filtro.ano ? { resenha: { ano: filtro.ano } } : {}),
    ...(filtro.semQrcode ? { resenha: { culto: { is: { qrcodeSvg: null } } } } : {}),
    ...(filtro.busca
      ? {
          OR: [
            { titulo: { contains: filtro.busca, mode: 'insensitive' as const } },
            { reflexao: { contains: filtro.busca, mode: 'insensitive' as const } },
          ],
        }
      : {}),
  };

  const [total, devocionais] = await Promise.all([
    connection.devocional.count({ where }),
    connection.devocional.findMany({
      where,
      orderBy: [{ resenha: { dataPregacao: 'asc' } }],
      skip: (filtro.pagina - 1) * filtro.porPagina,
      take: filtro.porPagina,
      select: {
        id: true,
        titulo: true,
        referencia: true,
        status: true,
        modelo: true,
        geradoEm: true,
        resenha: {
          select: {
            id: true,
            titulo: true,
            dataPregacao: true,
            culto: { select: { qrcodeSvg: true } },
          },
        },
      },
    }),
  ]);

  return {
    total,
    pagina: filtro.pagina,
    porPagina: filtro.porPagina,
    paginas: Math.ceil(total / filtro.porPagina),
    devocionais: devocionais.map((d) => ({
      id: d.id,
      titulo: d.titulo,
      referencia: d.referencia,
      status: d.status,
      modelo: d.modelo,
      geradoEm: d.geradoEm,
      resenhaId: d.resenha.id,
      resenha: d.resenha.titulo,
      dataPregacao: d.resenha.dataPregacao,
      // Sem QR a página sai sem o quadrado; é dado de triagem, não defeito.
      temQrcode: d.resenha.culto?.qrcodeSvg != null,
    })),
  };
}
