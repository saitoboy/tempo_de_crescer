import 'dotenv/config';
import express, { Request, Response } from 'express';
import cors from 'cors';
import { AddressInfo } from 'net';
import connection from './connection';

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

const server = app.listen(process.env.PORT || 3003, () => {
  const address = server.address() as AddressInfo;
  console.log(`Server is running in http://localhost:${address.port}`);
});
