import './utils/timezone';
import 'dotenv/config';
import express, { Request, Response } from 'express';
import cors from 'cors';
import { AddressInfo } from 'net';
import connection from './connection';
import { config } from './config';
import { agendarIngestao, executarIngestao } from './services/agendamento';
import { logInfo, logSuccess } from './utils/logger';
import { aplicarProxy } from './utils/proxy';

const app = express();
app.use(express.json());
app.use(cors());

app.get('/health', async (_req: Request, res: Response) => {
  try {
    const [resenhas, cultos, pregadores] = await Promise.all([
      connection.resenha.count(),
      connection.culto.count(),
      connection.pregador.count(),
    ]);
    res.json({ ok: true, resenhas, cultos, pregadores });
  } catch (e) {
    res.status(500).json({ ok: false, erro: (e as Error).message });
  }
});

const server = app.listen(config.PORT, () => {
  const address = server.address() as AddressInfo;
  logSuccess(`no ar em http://localhost:${address.port}`, 'server');

  const proxy = aplicarProxy();
  if (proxy) logInfo(proxy, 'proxy');

  const cron = agendarIngestao();
  logInfo(cron ? `ingestão agendada: ${cron} (${config.TZ})` : 'ingestão desligada', 'cron');

  // Uma passada na subida, sem bloquear o boot. Num banco recém-criado é ela
  // que carrega o acervo inteiro; num banco já populado não baixa nada. Erros
  // são tratados dentro de executarIngestao e não derrubam o servidor.
  //
  // Segue o mesmo interruptor do agendamento: CRON_INGESTAO=off desliga as
  // duas coisas, para o desenvolvimento não bater no blog a cada reinício.
  if (cron) void executarIngestao();
});
