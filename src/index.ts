import './utils/timezone';
import 'dotenv/config';
import express, { Request, Response } from 'express';
import cors from 'cors';
import { AddressInfo } from 'net';
import connection from './connection';
import swaggerUi from 'swagger-ui-express';
import { config } from './config';
import { BASE, especificacao } from './docs/openapi';
import { tratarErros } from './middlewares/erros';
import { rotasCultos } from './routes/cultos';
import { rotasPregadores } from './routes/pregadores';
import { rotasResenhas } from './routes/resenhas';
import { agendarIngestao, executarIngestao } from './services/agendamento';
import { logInfo, logSuccess } from './utils/logger';
import { aplicarProxy } from './utils/proxy';

const app = express();
app.use(express.json());
app.use(cors());

async function saude(_req: Request, res: Response) {
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
}

// Tudo sob /api/v1: o front e o livro vão consumir isto por anos, e mudar de
// contrato depois sem versão na URL quebraria quem já integrou.
//
// O /health sem prefixo fica de fora da versão de propósito: é o endereço que
// o EasyPanel consulta para saber se o contêiner está vivo, e isso não deve
// depender de qual versão da API está no ar.
app.get('/health', saude);
app.get(`${BASE}/health`, saude);

app.use(`${BASE}/cultos`, rotasCultos);
app.use(`${BASE}/resenhas`, rotasResenhas);
app.use(`${BASE}/pregadores`, rotasPregadores);

app.get(`${BASE}/openapi.json`, (_req: Request, res: Response) => res.json(especificacao));
app.use(
  `${BASE}/docs`,
  swaggerUi.serve,
  swaggerUi.setup(especificacao, {
    customSiteTitle: 'Tempo de Crescer — API',
    swaggerOptions: { docExpansion: 'list', defaultModelsExpandDepth: -1 },
  }),
);

// Depois das rotas, senão o Express não o reconhece como tratador de erro.
app.use(tratarErros);

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
