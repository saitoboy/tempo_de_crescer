import { describe, expect, expectTypeOf, it } from 'vitest';
import type { z } from 'zod';
import { especificacao } from './openapi';
import * as R from './respostas';
import type { PaginaDoLivro } from '../services/livro';
import type { Candidato } from '../services/curadoriaDoLivro';

/**
 * Os esquemas de resposta descrevem o que os serviços já devolvem, e descrição
 * mente com o tempo. Estes testes são o que impede isso de acontecer em
 * silêncio.
 */

type Operacao = { responses?: Record<string, { content?: unknown }> };
const paths = especificacao.paths as Record<string, Record<string, Operacao>>;

describe('openapi', () => {
  it('toda resposta de sucesso publica esquema', () => {
    const sem: string[] = [];

    for (const [rota, metodos] of Object.entries(paths)) {
      for (const [metodo, op] of Object.entries(metodos)) {
        for (const [codigo, resposta] of Object.entries(op.responses ?? {})) {
          if (codigo.startsWith('2') && !resposta.content) {
            sem.push(`${metodo.toUpperCase()} ${rota} ${codigo}`);
          }
        }
      }
    }

    // Sem isto o openapi-typescript gera `content?: never` e o front fica sem
    // o tipo da resposta — que foi o motivo de existir um esquemas.ts à mão.
    expect(sem).toEqual([]);
  });

  it('o documento serializa como JSON', () => {
    // É o que GET /openapi.json devolve. Uma referência circular ou um
    // `undefined` no meio só apareceria aqui.
    expect(() => JSON.stringify(especificacao)).not.toThrow();
  });

  it('toda rota fechada declara 401', () => {
    const abertas = ['/health', '/sessao/login', '/cultos/{id}/qrcode.svg', '/livro/imprimir.html'];
    const semQuatroUmUm: string[] = [];

    for (const [rota, metodos] of Object.entries(paths)) {
      if (abertas.includes(rota)) continue;
      for (const [metodo, op] of Object.entries(metodos)) {
        if (!op.responses?.['401']) semQuatroUmUm.push(`${metodo.toUpperCase()} ${rota}`);
      }
    }

    expect(semQuatroUmUm).toEqual([]);
  });
});

describe('respostas', () => {
  /**
   * Onde o serviço tem tipo próprio, ele é a referência: o esquema tem de
   * aceitar exatamente o que a função devolve. Se `PaginaDoLivro` ganhar um
   * campo e o esquema não, isto para de compilar.
   */
  it('paginaDoLivro acompanha o tipo do serviço', () => {
    expectTypeOf<z.infer<typeof R.paginaDoLivro>>().toEqualTypeOf<PaginaDoLivro>();
  });

  it('candidatos acompanha o tipo da curadoria', () => {
    expectTypeOf<z.infer<typeof R.candidatos>[number]>().toEqualTypeOf<Candidato>();
  });

  it('a listagem paginada tem o envelope completo', () => {
    const amostra = {
      total: 1403,
      pagina: 1,
      porPagina: 20,
      paginas: 71,
      resenhas: [],
    };

    expect(R.listaDeResenhas.safeParse(amostra).success).toBe(true);
  });

  it('recusa listagem sem o envelope', () => {
    expect(R.listaDeResenhas.safeParse({ resenhas: [] }).success).toBe(false);
  });
});
