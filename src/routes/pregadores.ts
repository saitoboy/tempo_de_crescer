import { Router } from 'express';
import { z } from 'zod';
import connection from '../connection';
import { exigirToken } from '../middlewares/autenticacao';
import { assincrono } from '../middlewares/erros';
import { chave } from '../services/pregadores';
import { NotFoundError, ValidationError } from '../utils/logger';

export const rotasPregadores = Router();

rotasPregadores.get(
  '/',
  assincrono(async (_req, res) => {
    const pregadores = await connection.pregador.findMany({
      orderBy: [{ tipo: 'asc' }, { nomeCanonico: 'asc' }],
      include: { _count: { select: { resenhas: true } } },
    });

    res.json(
      pregadores.map((p) => ({
        id: p.id,
        nomeCanonico: p.nomeCanonico,
        tipo: p.tipo,
        aliases: p.aliases,
        resenhas: p._count.resenhas,
      })),
    );
  }),
);

export const novoPregador = z.object({
  nomeCanonico: z.string().trim().min(2).max(120),
  tipo: z.enum(['PASTOR', 'SEMINARISTA', 'CONVIDADO', 'IRMAO']).default('CONVIDADO'),
  aliases: z.array(z.string().trim().min(2)).default([]),
});

rotasPregadores.post(
  '/',
  exigirToken,
  assincrono(async (req, res) => {
    const dados = novoPregador.parse(req.body);

    const jaExiste = await connection.pregador.findUnique({
      where: { nomeCanonico: dados.nomeCanonico },
      select: { id: true },
    });
    if (jaExiste) {
      throw new ValidationError('Já existe pregador com esse nome', [
        { campo: 'nomeCanonico', mensagem: 'nome já cadastrado' },
      ]);
    }

    const criado = await connection.pregador.create({
      data: {
        ...dados,
        // O nome canônico entra como alias para a resolução encontrar quem
        // for citado exatamente assim numa resenha.
        aliases: [...new Set([chave(dados.nomeCanonico), ...dados.aliases.map(chave)])],
      },
    });

    res.status(201).json(criado);
  }),
);

export const fusaoPregador = z.object({ deId: z.uuid() });

/**
 * Funde dois cadastros que são a mesma pessoa.
 *
 * O blog escreve o mesmo nome de várias formas, e nem toda variação estava
 * prevista no seed. As resenhas do cadastro absorvido passam para o que fica,
 * e as grafias dele viram aliases — para a próxima ingestão não recriá-lo.
 */
rotasPregadores.post(
  '/:id/fundir',
  exigirToken,
  assincrono(async (req, res) => {
    const { id } = z.object({ id: z.uuid() }).parse(req.params);
    const { deId } = fusaoPregador.parse(req.body);

    if (id === deId) {
      throw new ValidationError('Um pregador não se funde consigo mesmo', [
        { campo: 'deId', mensagem: 'igual ao destino' },
      ]);
    }

    const [destino, origem] = await Promise.all([
      connection.pregador.findUnique({ where: { id } }),
      connection.pregador.findUnique({ where: { id: deId } }),
    ]);
    if (!destino) throw new NotFoundError(`Pregador ${id} não encontrado`);
    if (!origem) throw new NotFoundError(`Pregador ${deId} não encontrado`);

    const { count } = await connection.resenha.updateMany({
      where: { pregadorId: origem.id },
      data: { pregadorId: destino.id },
    });

    await connection.pregador.update({
      where: { id: destino.id },
      data: {
        aliases: [
          ...new Set([
            ...destino.aliases,
            chave(origem.nomeCanonico),
            ...origem.aliases.map(chave),
          ]),
        ],
      },
    });

    await connection.pregador.delete({ where: { id: origem.id } });

    res.json({
      status: 'ok',
      mensagem: `"${origem.nomeCanonico}" virou "${destino.nomeCanonico}"`,
      resenhasMovidas: count,
    });
  }),
);
