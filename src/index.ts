import './utils/timezone';
import 'dotenv/config';
import express, { Request, Response } from 'express';
import cors from 'cors';
import { AddressInfo } from 'net';
import connection from './connection';
import swaggerUi from 'swagger-ui-express';
import { config } from './config';
import { BASE, especificacao } from './docs/openapi';
import { exigirPapel } from './middlewares/autenticacao';
import { tratarErros } from './middlewares/erros';
import { rotasMeta } from './routes/meta';
import { rotasAnalise } from './routes/analise';
import { rotasCultos } from './routes/cultos';
import { rotasLivro } from './routes/livro';
import { rotasPregadores } from './routes/pregadores';
import { rotasResenhas } from './routes/resenhas';
import { rotasTemas } from './routes/temas';
import { rotasSessao } from './routes/sessao';
import { agendarEscrita, agendarIngestao, executarIngestao } from './services/agendamento';
import { logInfo, logSuccess } from './utils/logger';
import { aplicarProxy } from './utils/proxy';

const app = express();
app.use(express.json());

/**
 * CORS por origem declarada.
 *
 * `cors()` sem argumento responde `Access-Control-Allow-Origin: *`: qualquer
 * site na internet poderia chamar esta API com o token do usuário logado.
 * Com `FRONT_ORIGEM` preenchido, só as origens listadas passam.
 *
 * Vazio mantém aberto de propósito — Swagger e curl em desenvolvimento vivem
 * disso. Em produção, preencher.
 */
const origens = config.FRONT_ORIGEM.split(',')
  .map((o) => o.trim())
  .filter(Boolean);

app.use(cors(origens.length > 0 ? { origin: origens, credentials: true } : undefined));

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

/**
 * A leitura deixou de ser aberta.
 *
 * Era herança de quando o front seria público: o conteúdo já está no blog, então
 * expor o JSON não vazava nada. Com o app interno, o que a API devolve passa a
 * incluir a fila de curadoria, o que ainda não foi revisado e os devocionais
 * antes de o pastor aprovar — nada disso é para a internet.
 *
 * ADMIN passa em tudo, por dentro do `exigirPapel`.
 *
 * Duas rotas continuam abertas **de propósito**, e ficam registradas dentro dos
 * seus roteadores sem este porteiro: `/cultos/:id/qrcode.svg` e
 * `/livro/imprimir.html`. O navegador as busca fora do `fetch` — `<img>` e aba
 * nova não mandam cabeçalho `Authorization` — e o conteúdo delas é público de
 * qualquer forma: o QR aponta para o YouTube da igreja.
 */
const exigirLeitura = exigirPapel('LIDER', 'PASTOR');

app.use(`${BASE}/sessao`, rotasSessao);
app.use(`${BASE}/meta`, exigirLeitura, rotasMeta);
app.use(`${BASE}/analise`, exigirLeitura, rotasAnalise);
app.use(`${BASE}/cultos`, rotasCultos);
app.use(`${BASE}/livro`, rotasLivro);
app.use(`${BASE}/temas`, exigirLeitura, rotasTemas);
app.use(`${BASE}/resenhas`, exigirLeitura, rotasResenhas);
app.use(`${BASE}/pregadores`, exigirLeitura, rotasPregadores);

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

  logInfo(
    origens.length > 0 ? `CORS liberado para ${origens.join(', ')}` : 'CORS aberto — defina FRONT_ORIGEM em produção',
    'server',
  );

  const cron = agendarIngestao();
  logInfo(cron ? `ingestão agendada: ${cron} (${config.TZ})` : 'ingestão desligada', 'cron');

  // Produção só passou a escrever devocional quando a geração deixou de
  // depender do CLI do Claude, que autentica com a sessão da máquina.
  const escrita = agendarEscrita();
  logInfo(
    escrita
      ? `escrita agendada: ${escrita} (${config.DEVOCIONAIS_POR_EXECUCAO} por vez)`
      : 'escrita de devocionais desligada',
    'cron',
  );

  // Uma passada na subida, sem bloquear o boot. Num banco recém-criado é ela
  // que carrega o acervo inteiro; num banco já populado não baixa nada. Erros
  // são tratados dentro de executarIngestao e não derrubam o servidor.
  //
  // Segue o mesmo interruptor do agendamento: CRON_INGESTAO=off desliga as
  // duas coisas, para o desenvolvimento não bater no blog a cada reinício.
  if (cron) void executarIngestao();
});
