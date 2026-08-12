import '../utils/timezone';
import 'dotenv/config';
import connection from '../connection';
import { gerarQrCodesFaltantes } from '../services/qrcode';
import { logError, logSuccess } from '../utils/logger';

/** Gera o QR code dos cultos que já têm vídeo mas ainda não têm o código. */
async function main() {
  const feitos = await gerarQrCodesFaltantes();
  if (feitos === 0) logSuccess('todos os cultos com vídeo já têm QR code', 'culto');
}

main()
  .catch((e) => {
    logError((e as Error).message, 'culto');
    process.exit(1);
  })
  .finally(() => connection.$disconnect());
