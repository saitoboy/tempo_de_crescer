import { z } from 'zod';
import { filtroPregadores } from '../routes/analise';
import { filtroCultos } from '../routes/cultos';
import { filtroLivro } from '../routes/livro';
import { credenciais } from '../routes/sessao';
import { fusaoPregador, novoPregador } from '../routes/pregadores';
import { correcaoResenha, filtroListagem, filtroPendentes } from '../routes/resenhas';

/**
 * Especificação OpenAPI, montada a partir dos mesmos esquemas Zod que as rotas
 * usam para validar.
 *
 * A conversão sai do `z.toJSONSchema()`, nativo no Zod 4 — não há biblioteca
 * de ponte nem anotação duplicada. Se um campo mudar na validação, muda aqui
 * junto; a documentação não tem como divergir do que a API aceita.
 */

export const BASE = '/api/v1';

/** Zod gera `$schema`, que o OpenAPI 3.1 não quer no meio do documento. */
function esquema(zod: z.ZodType) {
  const { $schema, ...resto } = z.toJSONSchema(zod, { io: 'input' }) as Record<string, unknown>;
  return resto;
}

/** Converte um objeto Zod em lista de parâmetros de query. */
function parametrosDeQuery(zod: z.ZodType) {
  const json = esquema(zod) as {
    properties?: Record<string, unknown>;
    required?: string[];
  };

  return Object.entries(json.properties ?? {}).map(([nome, definicao]) => ({
    name: nome,
    in: 'query',
    required: json.required?.includes(nome) ?? false,
    schema: definicao,
  }));
}

const corpo = (zod: z.ZodType) => ({
  required: true,
  content: { 'application/json': { schema: esquema(zod) } },
});

const idNaRota = {
  name: 'id',
  in: 'path',
  required: true,
  schema: { type: 'string', format: 'uuid' },
};

const ERRO = {
  type: 'object',
  properties: {
    status: { type: 'string', example: 'erro' },
    mensagem: { type: 'string' },
    codigo: {
      type: 'string',
      enum: ['NAO_AUTORIZADO', 'SEM_TOKEN_CONFIGURADO', 'VALIDATION', 'NOT_FOUND', 'FORBIDDEN', 'INTERNAL_ERROR'],
    },
    detalhes: {
      type: 'array',
      items: {
        type: 'object',
        properties: { campo: { type: 'string' }, mensagem: { type: 'string' } },
      },
    },
    timestamp: { type: 'string', format: 'date-time' },
  },
};

const respostaErro = (descricao: string) => ({
  description: descricao,
  content: { 'application/json': { schema: { $ref: '#/components/schemas/Erro' } } },
});

/** Respostas que toda rota protegida devolve. */
const ERROS_DE_ESCRITA = {
  400: respostaErro('Dados inválidos'),
  401: respostaErro('Token ausente ou inválido'),
  404: respostaErro('Não encontrado'),
  503: respostaErro('API_TOKEN não configurado no servidor'),
};

const protegida = [{ tokenDeEscrita: [] }];

export const especificacao = {
  openapi: '3.1.0',
  info: {
    title: 'Tempo de Crescer',
    version: '1.0.0',
    description: [
      'Acervo de pregações da Igreja Batista do Parque Safira, de 2012 a 2026.',
      '',
      '**Leitura é aberta** — o conteúdo já é público no blog da igreja.',
      '**Escrita exige token**: `Authorization: Bearer $API_TOKEN`.',
      '',
      'O token único é provisório; o login por usuário e senha, com os papéis',
      'ADMIN, PASTOR e LIDER, entra na Fase 7.',
    ].join('\n'),
  },
  servers: [{ url: BASE, description: 'servidor atual' }],
  tags: [
    { name: 'Saúde', description: 'Estado do serviço' },
    { name: 'Resenhas', description: 'O texto publicado no blog sobre cada culto' },
    { name: 'Sessão', description: 'Login e identidade' },
    { name: 'Análise', description: 'O que a igreja tem ensinado ao longo do tempo' },
    { name: 'Livro', description: 'As páginas, o HTML para impressão e o IDML' },
    { name: 'Cultos', description: 'O encontro, com a transmissão e o QR code' },
    { name: 'Pregadores', description: 'Quem pregou, com as grafias que o blog usa' },
  ],
  components: {
    securitySchemes: {
      tokenDeEscrita: {
        type: 'http',
        scheme: 'bearer',
        description: 'O valor de API_TOKEN no ambiente do servidor.',
      },
    },
    schemas: { Erro: ERRO },
  },
  paths: {
    '/health': {
      get: {
        tags: ['Saúde'],
        summary: 'Contagem do que está no banco',
        responses: {
          200: {
            description: 'Serviço no ar',
            content: {
              'application/json': {
                example: { ok: true, resenhas: 1409, cultos: 1026, pregadores: 51 },
              },
            },
          },
        },
      },
    },

    '/resenhas/pendentes': {
      get: {
        tags: ['Resenhas'],
        summary: 'A fila de revisão',
        description: [
          'O que a ingestão não conseguiu completar sozinha.',
          '',
          'Sem filtro, devolve tudo que tem **alguma** lacuna. Com `semPregador`',
          'e `semData` juntos, devolve só as que têm **as duas**.',
        ].join('\n'),
        parameters: parametrosDeQuery(filtroPendentes),
        responses: { 200: { description: 'Página da fila' } },
      },
    },

    '/resenhas': {
      get: {
        tags: ['Resenhas'],
        summary: 'Listagem',
        parameters: parametrosDeQuery(filtroListagem),
        responses: { 200: { description: 'Página de resenhas' } },
      },
    },

    '/resenhas/{id}': {
      get: {
        tags: ['Resenhas'],
        summary: 'Uma resenha, com culto, classificação e devocional',
        parameters: [idNaRota],
        responses: { 200: { description: 'A resenha' }, 404: respostaErro('Resenha não encontrada') },
      },
      patch: {
        tags: ['Resenhas'],
        summary: 'Correção manual',
        description: [
          'Tudo que passa por aqui é marcado **MANUAL**, separado do que o',
          'parser extraiu do texto (`TEXTO`).',
          '',
          'A correção **não inventa pregador**: nome que não resolve pelos',
          'aliases é recusado com sugestão, e cadastrar gente nova exige',
          '`criarSeNaoExistir: true`.',
        ].join('\n'),
        security: protegida,
        parameters: [idNaRota],
        requestBody: corpo(correcaoResenha),
        responses: { 200: { description: 'Resenha corrigida' }, ...ERROS_DE_ESCRITA },
      },
    },

    '/sessao/login': {
      post: {
        tags: ['Sessão'],
        summary: 'Entra e recebe o token de sessão',
        description:
          'A resposta é a mesma para e-mail inexistente, senha errada e conta inativa: dizer qual dos três falhou entregaria quais e-mails existem.',
        requestBody: corpo(credenciais),
        responses: { 200: { description: 'Token e dados do usuário' }, 401: respostaErro('E-mail ou senha inválidos') },
      },
    },

    '/sessao/eu': {
      get: {
        tags: ['Sessão'],
        summary: 'Quem sou eu',
        security: protegida,
        responses: { 200: { description: 'O usuário da sessão' }, 401: respostaErro('Faça login') },
      },
    },

    '/analise/panorama': {
      get: { tags: ['Análise'], summary: 'Números do acervo', responses: { 200: { description: 'Panorama' } } },
    },
    '/analise/doutrinas': {
      get: {
        tags: ['Análise'],
        summary: 'Distribuição por doutrina',
        description: 'Só o tema PRINCIPAL conta; somar os secundários faria o total passar do número de pregações.',
        responses: { 200: { description: 'As 8 doutrinas com contagem e percentual' } },
      },
    },
    '/analise/evolucao': {
      get: {
        tags: ['Análise'],
        summary: 'Ênfase doutrinária ano a ano',
        description: 'Usa apenas data de origem TEXTO, para a série histórica não misturar o que é firme com o que foi inferido.',
        responses: { 200: { description: 'Série por ano' } },
      },
    },
    '/analise/pregadores': {
      get: {
        tags: ['Análise'],
        summary: 'O que cada pregador enfatiza',
        parameters: parametrosDeQuery(filtroPregadores),
        responses: { 200: { description: 'Perfil por pregador' } },
      },
    },
    '/analise/biblia': {
      get: {
        tags: ['Análise'],
        summary: 'Cobertura bíblica',
        description: 'A pergunta interessante não é qual livro aparece mais, e sim qual nunca apareceu — por isso os 66 vêm sempre.',
        responses: { 200: { description: 'Cobertura, mais pregados e nunca pregados' } },
      },
    },

    '/livro/paginas': {
      get: {
        tags: ['Livro'],
        summary: 'As páginas do livro, em JSON',
        parameters: parametrosDeQuery(filtroLivro),
        responses: { 200: { description: 'Páginas montadas' } },
      },
    },
    '/livro/imprimir.html': {
      get: {
        tags: ['Livro'],
        summary: 'O livro em HTML, pronto para imprimir em A5',
        description:
          'Abrir no navegador e imprimir para PDF dá o arquivo final. O texto justificado, a hifenização, as viúvas e as órfãs ficam a cargo do motor de texto do navegador, que faz isso melhor do que montar em coordenadas à mão.',
        parameters: parametrosDeQuery(filtroLivro),
        responses: { 200: { description: 'HTML A5', content: { 'text/html': { schema: { type: 'string' } } } } },
      },
    },
    '/livro/livro.idml': {
      get: {
        tags: ['Livro'],
        summary: 'O livro em IDML, para o designer refinar no InDesign',
        description:
          'Pacote com um spread por página e os quadros de texto nomeados (Titulo, Versiculo, Creditos, Reflexao, PontosAplicacao, QRCode, Oracao, Anotacoes). NÃO foi aberto no InDesign — a estrutura segue a especificação, mas isso ainda é promessa, não fato.',
        parameters: parametrosDeQuery(filtroLivro),
        responses: { 200: { description: 'Pacote IDML' } },
      },
    },

    '/cultos': {
      get: {
        tags: ['Cultos'],
        summary: 'Listagem de cultos',
        description: 'Filtra por ano, turno, natureza e presença de vídeo.',
        parameters: parametrosDeQuery(filtroCultos),
        responses: { 200: { description: 'Página de cultos' } },
      },
    },

    '/cultos/{id}/qrcode.svg': {
      get: {
        tags: ['Cultos'],
        summary: 'QR code do culto, em SVG',
        description: [
          'Aponta para a transmissão no YouTube. Gerado na hora, não guardado:',
          'a imagem é função da URL, e guardar arquivo só criaria a chance de',
          'ele ficar desatualizado. SVG porque a página do livro é impressa.',
        ].join(' '),
        parameters: [idNaRota],
        responses: {
          200: { description: 'O QR code', content: { 'image/svg+xml': { schema: { type: 'string' } } } },
          404: respostaErro('Culto não encontrado, ou sem vídeo no YouTube'),
        },
      },
    },

    '/pregadores': {
      get: {
        tags: ['Pregadores'],
        summary: 'Cadastro, com a contagem de resenhas',
        responses: { 200: { description: 'Todos os pregadores' } },
      },
      post: {
        tags: ['Pregadores'],
        summary: 'Cadastra',
        description: 'O nome canônico entra automaticamente como alias.',
        security: protegida,
        requestBody: corpo(novoPregador),
        responses: { 201: { description: 'Cadastrado' }, ...ERROS_DE_ESCRITA },
      },
    },

    '/pregadores/{id}/fundir': {
      post: {
        tags: ['Pregadores'],
        summary: 'Funde duas grafias da mesma pessoa',
        description: [
          'As resenhas do cadastro absorvido passam para o que fica, e as',
          'grafias dele viram aliases — para a próxima ingestão não o recriar.',
        ].join('\n'),
        security: protegida,
        parameters: [{ ...idNaRota, description: 'O pregador que **fica**' }],
        requestBody: corpo(fusaoPregador),
        responses: { 200: { description: 'Fundido' }, ...ERROS_DE_ESCRITA },
      },
    },
  },
};
