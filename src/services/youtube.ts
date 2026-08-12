import { config } from '../config';
import type { Turno } from '../generated/prisma/enums';

/**
 * Leitura do canal da igreja no YouTube.
 *
 * Quase todo vídeo é a transmissão de um culto, e o que interessa é o
 * `actualStartTime`: a hora em que a live começou de verdade. A hora de
 * publicação não serve — o vídeo costuma ser publicado no dia seguinte.
 *
 * O título traz o pregador depois de um "I" maiúsculo, usado como separador:
 *     SEMENTES I Pr. Nélio Monteiro
 */

const API = 'https://www.googleapis.com/youtube/v3';
const POR_PAGINA = 50;

/** Antes disso é manhã; a partir disso, noite. O culto de quarta é sempre à noite. */
const HORA_DE_CORTE = 13;

export type VideoDoCanal = {
  videoId: string;
  titulo: string;
  url: string;
  /** Data do encontro em ISO, no fuso de São Paulo. */
  data: string;
  turno: Turno;
  /** Nome do pregador como aparece no título, antes de resolver o alias. */
  pregadorBruto: string | null;
  /** true quando veio de transmissão ao vivo, e não de um vídeo publicado. */
  aoVivo: boolean;
};

async function chamar(caminho: string, params: Record<string, string>) {
  const url = new URL(`${API}/${caminho}`);
  for (const [chave, valor] of Object.entries({ ...params, key: config.YOUTUBE_API_KEY! })) {
    url.searchParams.set(chave, valor);
  }

  const resposta = await fetch(url);
  const corpo = (await resposta.json()) as any;

  if (!resposta.ok) {
    throw new Error(`YouTube ${caminho}: ${corpo.error?.message ?? resposta.status}`);
  }
  return corpo;
}

/** A playlist onde o YouTube guarda tudo que o canal publicou. */
export async function playlistDeUploads(): Promise<string> {
  const canal = await chamar('channels', {
    part: 'contentDetails',
    forHandle: config.CHANNEL_HANDLE,
  });

  const uploads = canal.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
  if (!uploads) throw new Error(`Canal ${config.CHANNEL_HANDLE} não encontrado`);
  return uploads;
}

/**
 * Data e hora no fuso de São Paulo.
 *
 * O YouTube devolve UTC; converter importa porque um culto de domingo à noite
 * em UTC já é segunda-feira.
 */
export function emSaoPaulo(iso: string): { data: string; hora: number } {
  const partes = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hour12: false,
  }).formatToParts(new Date(iso));

  const pegar = (tipo: string) => partes.find((p) => p.type === tipo)!.value;
  return {
    data: `${pegar('year')}-${pegar('month')}-${pegar('day')}`,
    hora: Number(pegar('hour')),
  };
}

/**
 * Quem pregou, segundo o título do vídeo.
 *
 * O separador é um "I" maiúsculo isolado, não uma barra vertical. Alguns
 * títulos trazem o título eclesiástico junto ("Pr."), outros só o nome.
 */
export function extrairPregadorDoTitulo(titulo: string): string | null {
  const partes = titulo.split(/\s+I\s+/);
  if (partes.length < 2) return null;

  const nome = partes
    .at(-1)!
    .replace(/^(Pr\.?|Pra\.?|Pastor(a)?|Rev\.?|Sem\.?|Seminarista|Miss\.?|Mission[áa]ri[oa]|Irm[ãa]o?)\s+/i, '')
    .replace(/[.\s]+$/, '')
    .trim();

  return nome.length > 1 ? nome : null;
}

function paraVideo(item: any): VideoDoCanal | null {
  const inicio = item.liveStreamingDetails?.actualStartTime;
  const quando = inicio ?? item.snippet?.publishedAt;
  if (!quando) return null;

  const { data, hora } = emSaoPaulo(quando);

  return {
    videoId: item.id,
    titulo: item.snippet.title,
    url: `https://www.youtube.com/watch?v=${item.id}`,
    data,
    turno: hora < HORA_DE_CORTE ? 'DIA' : 'NOITE',
    pregadorBruto: extrairPregadorDoTitulo(item.snippet.title),
    aoVivo: Boolean(inicio),
  };
}

/**
 * Todos os vídeos do canal, com o horário real da transmissão.
 *
 * São duas chamadas por página de 50: a playlist dá os ids, e `videos` dá o
 * `liveStreamingDetails`, que a playlist não traz. Com ~934 vídeos, são 38
 * chamadas — bem dentro da cota diária de 10.000 unidades.
 */
export async function listarVideos(
  aoProgredir?: (feitos: number, total: number) => void,
): Promise<VideoDoCanal[]> {
  const playlist = await playlistDeUploads();
  const videos: VideoDoCanal[] = [];
  let pagina: string | undefined;
  let total = 0;

  do {
    const lote = await chamar('playlistItems', {
      part: 'contentDetails',
      playlistId: playlist,
      maxResults: String(POR_PAGINA),
      ...(pagina ? { pageToken: pagina } : {}),
    });

    total = lote.pageInfo?.totalResults ?? total;
    const ids = lote.items.map((i: any) => i.contentDetails.videoId).join(',');

    const detalhes = await chamar('videos', { part: 'snippet,liveStreamingDetails', id: ids });
    for (const item of detalhes.items ?? []) {
      const video = paraVideo(item);
      if (video) videos.push(video);
    }

    aoProgredir?.(videos.length, total);
    pagina = lote.nextPageToken;
  } while (pagina);

  return videos;
}
