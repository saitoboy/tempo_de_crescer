import connection from '../connection';
import type { Provedor as ProvedorDoBanco } from '../generated/prisma/enums';
import { cifrar, decifrar, finalDe, podeCifrar } from '../utils/cifra';
import { logWarning } from '../utils/logger';
import { ValidationError } from '../utils/logger';

/**
 * As chaves de API dos provedores, guardadas no banco.
 *
 * Antes viviam só no `.env`. Não dava: a cota diária da Groq é de 200.000
 * tokens por chave — uns 44 devocionais — então acrescentar e trocar chave é
 * rotina, e cada troca custava um redeploy.
 *
 * **As do ambiente continuam valendo.** São a partida: sem elas, um banco novo
 * sobe sem chave nenhuma e não gera nada até alguém abrir a tela. As duas
 * fontes se somam, e o banco tem prioridade na ordem.
 */

const CONTEXTO = 'devocional';

/**
 * Por quanto tempo as chaves do banco ficam em memória.
 *
 * Sem cache, cada devocional gerado faria uma consulta e uma decifragem por
 * chave. Com cache eterno, chave nova só valeria depois de reiniciar — que é
 * exatamente o problema que esta tabela existe para resolver.
 *
 * Um minuto: quem acabou de cadastrar vê funcionar antes de desconfiar.
 */
const VALIDADE_MS = 60_000;

let cache: { em: number; chaves: Map<ProvedorDoBanco, string[]> } | null = null;

export function esquecerCache(): void {
  cache = null;
}

/** As chaves ativas de cada provedor, decifradas. */
export async function chavesGuardadas(): Promise<Map<ProvedorDoBanco, string[]>> {
  if (cache && Date.now() - cache.em < VALIDADE_MS) return cache.chaves;

  const chaves = new Map<ProvedorDoBanco, string[]>();

  // Sem o segredo não há como ler o que está guardado. Avisar e seguir com as
  // do ambiente é melhor que derrubar a geração inteira.
  if (!podeCifrar()) {
    const quantas = await connection.chaveDeApi.count({ where: { ativa: true } });
    if (quantas > 0) {
      logWarning(
        `${quantas} chaves guardadas no banco não puderam ser lidas: falta CHAVES_SEGREDO no ambiente`,
        CONTEXTO,
      );
    }
    cache = { em: Date.now(), chaves };
    return chaves;
  }

  const guardadas = await connection.chaveDeApi.findMany({
    where: { ativa: true },
    orderBy: { criadaEm: 'asc' },
    select: { id: true, provedor: true, segredo: true, rotulo: true },
  });

  for (const g of guardadas) {
    try {
      const lista = chaves.get(g.provedor) ?? [];
      lista.push(decifrar(g.segredo));
      chaves.set(g.provedor, lista);
    } catch (e) {
      // Uma chave ilegível não pode derrubar as outras — quase sempre é o
      // CHAVES_SEGREDO trocado depois que ela foi gravada.
      logWarning(`chave "${g.rotulo}" não pôde ser lida: ${(e as Error).message}`, CONTEXTO);
    }
  }

  cache = { em: Date.now(), chaves };
  return chaves;
}

export type ChaveNova = {
  provedor: ProvedorDoBanco;
  rotulo: string;
  chave: string;
};

export async function guardarChave(nova: ChaveNova) {
  if (!podeCifrar()) {
    throw new ValidationError('CHAVES_SEGREDO não está configurado no servidor', [
      { campo: 'chave', mensagem: 'sem ele a chave não pode ser cifrada' },
    ]);
  }

  const final = finalDe(nova.chave);

  const repetida = await connection.chaveDeApi.findFirst({
    where: { provedor: nova.provedor, final, rotulo: nova.rotulo },
    select: { id: true },
  });
  if (repetida) {
    throw new ValidationError('Já existe uma chave com este rótulo e final', [
      { campo: 'rotulo', mensagem: 'use outro rótulo para distinguir' },
    ]);
  }

  const salva = await connection.chaveDeApi.create({
    data: {
      provedor: nova.provedor,
      rotulo: nova.rotulo,
      segredo: cifrar(nova.chave),
      final,
    },
    select: CAMPOS_VISIVEIS,
  });

  esquecerCache();
  return salva;
}

/**
 * O que a API pode mostrar.
 *
 * `segredo` fica fora de propósito, e não por esquecimento: a chave entra uma
 * vez e nunca mais sai. Quem precisar dela de novo cadastra outra.
 */
const CAMPOS_VISIVEIS = {
  id: true,
  provedor: true,
  rotulo: true,
  final: true,
  ativa: true,
  ultimoErro: true,
  ultimoErroEm: true,
  usadaEm: true,
  criadaEm: true,
} as const;

export function listarChaves() {
  return connection.chaveDeApi.findMany({
    orderBy: [{ provedor: 'asc' }, { criadaEm: 'asc' }],
    select: CAMPOS_VISIVEIS,
  });
}

export async function alternarChave(id: string, ativa: boolean) {
  const salva = await connection.chaveDeApi.update({
    where: { id },
    data: { ativa },
    select: CAMPOS_VISIVEIS,
  });

  esquecerCache();
  return salva;
}

export async function apagarChave(id: string) {
  await connection.chaveDeApi.delete({ where: { id } });
  esquecerCache();
}
