import connection from '../connection';
import { logInfo, logSuccess, logWarning, progresso } from '../utils/logger';
import { resolverPregador } from './pregadores';
import { listarVideos, type VideoDoCanal } from './youtube';

/**
 * Casa cada culto com a transmissão dele no YouTube.
 *
 * A chave é data + turno, ambos derivados do horário real em que a live
 * começou. Nada é casado por aproximação: culto sem data ou sem turno no banco
 * fica de fora, porque casar "o vídeo mais próximo" inventaria vínculo.
 *
 * De quebra, o título do vídeo traz o pregador — o que preenche parte das
 * resenhas que ficaram sem assinatura.
 */

export type ResultadoCasamento = {
  videos: number;
  cultosCasados: number;
  pregadoresPreenchidos: number;
  divergencias: Array<{ data: string; noBanco: string; noYoutube: string; titulo: string }>;
  semCultoCorrespondente: number;
};

export async function casarComYoutube(): Promise<ResultadoCasamento> {
  logInfo('lendo o canal...', 'youtube');

  const videos = await listarVideos((feitos, total) =>
    logInfo(`${feitos}/${total} vídeos lidos`, 'youtube'),
  );
  logSuccess(`${videos.length} vídeos no canal`, 'youtube');

  const resultado: ResultadoCasamento = {
    videos: videos.length,
    cultosCasados: 0,
    pregadoresPreenchidos: 0,
    divergencias: [],
    semCultoCorrespondente: 0,
  };

  const pregadores = await connection.pregador.findMany({
    select: { id: true, nomeCanonico: true, aliases: true },
  });

  const barra = progresso('vídeos', videos.length, 'youtube');
  let feitos = 0;

  for (const video of videos) {
    await casarUm(video, pregadores, resultado);
    barra.atualizar(++feitos);
  }

  barra.concluir(`${resultado.cultosCasados} cultos ligados ao YouTube`);
  return resultado;
}

async function casarUm(
  video: VideoDoCanal,
  pregadores: Array<{ id: string; nomeCanonico: string; aliases: string[] }>,
  resultado: ResultadoCasamento,
) {
  const culto = await connection.culto.findFirst({
    where: { data: new Date(`${video.data}T00:00:00Z`), turno: video.turno },
    include: {
      resenhas: {
        select: { id: true, pregadorId: true, pregador: { select: { nomeCanonico: true } } },
      },
    },
  });

  if (!culto) {
    resultado.semCultoCorrespondente++;
    return;
  }

  // O vídeo é único por culto: se dois caírem na mesma data e turno, o
  // youtubeVideoId é unique e o segundo seria recusado. Ficar com o primeiro
  // é melhor que trocar a cada execução.
  if (!culto.youtubeVideoId) {
    await connection.culto.update({
      where: { id: culto.id },
      data: { youtubeVideoId: video.videoId, youtubeUrl: video.url, tituloLive: video.titulo },
    });
    resultado.cultosCasados++;
  }

  if (!video.pregadorBruto) return;

  const doYoutube = resolverPregador(video.pregadorBruto, pregadores);
  if (!doYoutube) return;

  for (const resenha of culto.resenhas) {
    // Sem pregador no texto: o título da live preenche.
    if (!resenha.pregadorId) {
      await connection.resenha.update({
        where: { id: resenha.id },
        data: {
          pregadorId: doYoutube.id,
          pregadorBruto: video.pregadorBruto,
          pregadorOrigem: 'YOUTUBE',
        },
      });
      resultado.pregadoresPreenchidos++;
      continue;
    }

    // Já tinha pregador e o YouTube discorda: não sobrescreve. A assinatura da
    // resenha e o título da live são fontes diferentes, e nenhuma das duas é
    // boa o bastante para calar a outra sozinha. Fica registrado para revisão.
    if (resenha.pregadorId !== doYoutube.id) {
      resultado.divergencias.push({
        data: video.data,
        noBanco: resenha.pregador?.nomeCanonico ?? '—',
        noYoutube: doYoutube.nomeCanonico,
        titulo: video.titulo,
      });
    }
  }
}

export function relatar(resultado: ResultadoCasamento) {
  logSuccess(`${resultado.cultosCasados} cultos ganharam vídeo`, 'youtube');

  if (resultado.pregadoresPreenchidos > 0) {
    logSuccess(
      `${resultado.pregadoresPreenchidos} resenhas ganharam pregador pelo título da live`,
      'pregador',
    );
  }

  if (resultado.semCultoCorrespondente > 0) {
    logInfo(
      `${resultado.semCultoCorrespondente} vídeos sem culto correspondente no banco`,
      'youtube',
    );
  }

  if (resultado.divergencias.length > 0) {
    logWarning(
      `${resultado.divergencias.length} divergências entre a assinatura e o título da live`,
      'youtube',
      resultado.divergencias.slice(0, 15),
    );
  }
}
