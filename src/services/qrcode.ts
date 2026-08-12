import QRCode from 'qrcode';
import connection from '../connection';
import { progresso } from '../utils/logger';

/**
 * QR codes das transmissões, guardados no banco.
 *
 * A montagem do livro empacota centenas de páginas de uma vez para o designer;
 * regerar cada QR nessa hora seria desperdício. Guardar também garante que o
 * arquivo entregue e o banco mostrem o mesmo código.
 *
 * SVG, não PNG: é vetor, não perde na impressão em A5, e ocupa menos.
 */

/** Correção alta: vai impresso, e será lido de papel dobrado e com luz ruim. */
const OPCOES = { type: 'svg', margin: 1, errorCorrectionLevel: 'H' } as const;

export function gerarSvg(url: string): Promise<string> {
  return QRCode.toString(url, OPCOES);
}

/** Forma embutível direto em HTML, CSS ou InDesign. */
export function comoDataUri(svg: string): string {
  return `data:image/svg+xml;base64,${Buffer.from(svg, 'utf8').toString('base64')}`;
}

/**
 * Gera o que falta. Idempotente: culto que já tem QR não é tocado, a menos
 * que a URL do vídeo tenha mudado.
 */
export async function gerarQrCodesFaltantes(): Promise<number> {
  const cultos = await connection.culto.findMany({
    where: { youtubeUrl: { not: null }, qrcodeSvg: null },
    select: { id: true, youtubeUrl: true },
  });

  if (cultos.length === 0) return 0;

  const barra = progresso('QR codes', cultos.length, 'culto');
  let feitos = 0;

  for (const culto of cultos) {
    await connection.culto.update({
      where: { id: culto.id },
      data: { qrcodeSvg: await gerarSvg(culto.youtubeUrl!) },
    });
    barra.atualizar(++feitos);
  }

  barra.concluir(`${feitos} QR codes guardados`);
  return feitos;
}
