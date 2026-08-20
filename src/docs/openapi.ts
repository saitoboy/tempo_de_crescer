import { z } from 'zod';
import { filtroPregadores } from '../routes/analise';
import { filtroCultos } from '../routes/cultos';
import { filtroLivro } from '../routes/livro';
import { credenciais } from '../routes/sessao';
import { fusaoPregador, novoPregador } from '../routes/pregadores';
import { correcaoResenha, filtroListagem, filtroPendentes } from '../routes/resenhas';
import { filtroDeEscolha, filtroTemas, novaOrdem, novoTema, paginaEscolhida } from '../routes/temas';
import { filtroDevocionais } from '../routes/devocionais';
import { chaveNova, situacaoDaChave } from '../routes/chaves';
import { correcaoDeDevocional } from '../services/revisaoDeDevocional';
import * as R from './respostas';

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

/**
 * Uma resposta com esquema de verdade.
 *
 * Declarar só `description` fazia o `openapi-typescript` gerar `content?: never`
 * para todo 200 — o front tirava dali o tipo do corpo da requisição e nada mais,
 * e precisava de um arquivo de esquemas escrito à mão para as respostas.
 *
 * Aqui a conversão sai com `io: 'output'`: o que interessa é a forma **depois**
 * dos `transform`, que é o que o cliente recebe. Nos filtros de query é o
 * contrário, e por isso `esquema()` usa `input`.
 */
function respostaJson(descricao: string, zod: z.ZodType) {
  const { $schema, ...corpo } = z.toJSONSchema(zod, { io: 'output' }) as Record<string, unknown>;
  return {
    description: descricao,
    content: { 'application/json': { schema: corpo } },
  };
}

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

/** Escrita: token de sessão de um ADMIN, ou o API_TOKEN do ambiente. */
const protegida = [{ sessao: [] }, { tokenDeEscrita: [] }];

/** Leitura: exige login, de qualquer papel. */
const comLogin = [{ sessao: [] }];

/** Toda rota de leitura devolve isto quando não há sessão válida. */
const SEM_SESSAO = {
  401: respostaErro('Faça login para continuar'),
  403: respostaErro('Seu perfil não permite esta operação'),
};

export const especificacao = {
  openapi: '3.1.0',
  info: {
    title: 'Tempo de Crescer',
    version: '1.0.0',
    description: [
      'Acervo de pregações da Igreja Batista do Parque Safira, de 2012 a 2026.',
      '',
      '**Tudo exige login**, exceto `/health`, `/sessao/login` e as duas rotas',
      'que o navegador busca fora do `fetch`: `/cultos/{id}/qrcode.svg` e',
      '`/livro/imprimir.html` — `<img>` e aba nova não mandam `Authorization`,',
      'e o conteúdo delas já é público (o QR aponta para o YouTube da igreja).',
      '',
      'Entre em `/sessao/login` e mande `Authorization: Bearer <token>`.',
      'Papéis: ADMIN passa em tudo; LIDER e PASTOR leem; escrever é de ADMIN.',
      '',
      'O `API_TOKEN` único ainda é aceito na escrita, e sai quando as telas',
      'de escrita estiverem no ar.',
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
    { name: 'Temas do mês', description: 'A curadoria: qual devocional entra em qual mês do livro' },
    { name: 'Meta', description: 'O vocabulário do domínio' },
    { name: 'Devocionais', description: 'A revisão: o pastor corrige no papel, alguém digita aqui' },
    { name: 'Chaves', description: 'As chaves de API dos provedores de modelo' },
  ],
  components: {
    securitySchemes: {
      sessao: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'O token devolvido por POST /sessao/login.',
      },
      tokenDeEscrita: {
        type: 'http',
        scheme: 'bearer',
        description: 'O valor de API_TOKEN no ambiente do servidor. Provisório.',
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
          200: respostaJson('Serviço no ar', R.saude),
        },
      },
    },

    '/meta': {
      get: {
        tags: ['Meta'],
        summary: 'Os enums e as doutrinas',
        description: [
          'Existe para o front não escrever a lista de turnos à mão. Lista',
          'copiada envelhece: acrescentar um turno no schema e esquecer do',
          'front produz um filtro que não encontra nada, sem erro nenhum.',
        ].join('\n'),
        security: comLogin,
        responses: { 200: respostaJson('O vocabulário', R.meta), ...SEM_SESSAO },
      },
    },

    '/livro/paginas/{devocionalId}': {
      get: {
        tags: ['Livro'],
        summary: 'Os dados de uma página',
        security: comLogin,
        parameters: [{ ...idNaRota, name: 'devocionalId' }],
        responses: {
          200: respostaJson('A página', R.paginaDoLivro),
          404: respostaErro('Devocional não encontrado'),
          ...SEM_SESSAO,
        },
      },
    },

    '/temas': {
      get: {
        tags: ['Temas do mês'],
        summary: 'Os meses do livro',
        security: comLogin,
        parameters: parametrosDeQuery(filtroTemas),
        responses: { 200: respostaJson('Os temas', R.listaDeTemas), ...SEM_SESSAO },
      },
      post: {
        tags: ['Temas do mês'],
        summary: 'Cria o tema de um mês',
        security: protegida,
        requestBody: corpo(novoTema),
        responses: { 201: respostaJson('Criado', R.temaSalvo), ...ERROS_DE_ESCRITA },
      },
    },

    '/temas/{id}': {
      get: {
        tags: ['Temas do mês'],
        summary: 'Um mês, com as páginas já escolhidas na ordem',
        security: comLogin,
        parameters: [idNaRota],
        responses: { 200: respostaJson('O tema', R.temaCompleto), ...SEM_SESSAO },
      },
      patch: {
        tags: ['Temas do mês'],
        summary: 'Edita o tema',
        security: protegida,
        parameters: [idNaRota],
        requestBody: corpo(novoTema.partial()),
        responses: { 200: respostaJson('Editado', R.temaSalvo), ...ERROS_DE_ESCRITA },
      },
    },

    '/temas/{id}/sugestoes': {
      get: {
        tags: ['Temas do mês'],
        summary: 'Que devocionais podem entrar neste mês',
        description: [
          'Parte da doutrina do tema, mas tudo é sobreponível: por pastor, por',
          'ano da pregação, por palavra no título.',
          '',
          '**Traz só o pregador do livro.** É o único filtro que já vem',
          'aplicado: o livro é do Pr. Nélio, e o acervo tem devocional dos',
          'outros pregadores da casa. `pregadorId` troca por outro,',
          '`todosOsPregadores=true` abre para o acervo inteiro.',
          '',
          '`semantica=true` ordena por semelhança de significado com o tema, e',
          'é o caminho para os meses que não são doutrina — "As Mulheres da',
          'Bíblia", "Novas Gerações". Só aí vem a `afinidade`.',
        ].join('\n'),
        security: comLogin,
        parameters: [idNaRota, ...parametrosDeQuery(filtroDeEscolha)],
        responses: { 200: respostaJson('Os candidatos, do mais aderente ao menos', R.candidatos), ...SEM_SESSAO },
      },
    },

    '/temas/{id}/preencher': {
      post: {
        tags: ['Temas do mês'],
        summary: 'Preenche o mês de uma vez com as melhores sugestões',
        description: [
          'Escolher 31 devocionais de um em um é trabalho que a máquina faz',
          'igual: a ordem sugerida já é a de afinidade. O ganho da curadoria',
          'está em **trocar** o que não serve, não em repetir trinta vezes o',
          'que serve.',
          '',
          'Respeita o que já está escolhido — acrescenta ao fim, sem repetir e',
          'sem reordenar o que alguém já ajustou. E não passa dos dias do mês.',
          '',
          'Aceita os mesmos filtros de `/sugestoes`.',
        ].join('\n'),
        security: protegida,
        parameters: [idNaRota, ...parametrosDeQuery(filtroDeEscolha)],
        responses: { 200: respostaJson('Preenchido', R.mesPreenchido), ...ERROS_DE_ESCRITA },
      },
    },

    '/temas/{id}/paginas': {
      post: {
        tags: ['Temas do mês'],
        summary: 'Põe um devocional no mês',
        security: protegida,
        parameters: [idNaRota],
        requestBody: corpo(paginaEscolhida),
        responses: { 201: respostaJson('Adicionado', R.temaCompleto), ...ERROS_DE_ESCRITA },
      },
    },

    '/temas/{id}/paginas/{devocionalId}': {
      delete: {
        tags: ['Temas do mês'],
        summary: 'Tira um devocional do mês',
        security: protegida,
        parameters: [idNaRota, { ...idNaRota, name: 'devocionalId' }],
        responses: {
          200: respostaJson('Removido', R.confirmacao),
          ...ERROS_DE_ESCRITA,
        },
      },
    },

    '/temas/{id}/ordem': {
      patch: {
        tags: ['Temas do mês'],
        summary: 'Reordena as páginas do mês',
        security: protegida,
        parameters: [idNaRota],
        requestBody: corpo(novaOrdem),
        responses: { 200: respostaJson('Reordenado', R.temaCompleto), ...ERROS_DE_ESCRITA },
      },
    },

    '/chaves': {
      get: {
        tags: ['Chaves'],
        summary: 'As chaves cadastradas',
        description:
          'O valor da chave NUNCA é devolvido — só o rótulo e os quatro últimos caracteres. Ela entra uma vez e não sai mais.',
        security: comLogin,
        responses: { 200: respostaJson('As chaves', R.listaDeChaves), ...SEM_SESSAO },
      },
      post: {
        tags: ['Chaves'],
        summary: 'Cadastra uma chave',
        description: [
          'Existe porque a cota diária da Groq é de 200.000 tokens por chave —',
          'uns 44 devocionais — então acrescentar chave é rotina, e fazer isso',
          'pelo `.env` custa um redeploy a cada vez.',
          '',
          'A chave é cifrada com AES-256-GCM antes de gravar. Exige',
          '`CHAVES_SEGREDO` no ambiente do servidor.',
          '',
          'Vale em até um minuto, sem reiniciar: é o tempo do cache.',
        ].join('\n'),
        security: protegida,
        requestBody: corpo(chaveNova),
        responses: { 201: respostaJson('Cadastrada', R.chaveGuardada), ...ERROS_DE_ESCRITA },
      },
    },

    '/chaves/{id}': {
      patch: {
        tags: ['Chaves'],
        summary: 'Liga e desliga sem apagar',
        description:
          'Chave que estourou a cota do dia não precisa ser removida: desligar preserva o rótulo e o histórico de erro, que é o que ajuda a entender qual conta está rendendo.',
        security: protegida,
        parameters: [idNaRota],
        requestBody: corpo(situacaoDaChave),
        responses: { 200: respostaJson('Alterada', R.chaveGuardada), ...ERROS_DE_ESCRITA },
      },
      delete: {
        tags: ['Chaves'],
        summary: 'Remove a chave',
        security: protegida,
        parameters: [idNaRota],
        responses: { 200: respostaJson('Removida', R.confirmacao), ...ERROS_DE_ESCRITA },
      },
    },

    '/devocionais': {
      get: {
        tags: ['Devocionais'],
        summary: 'A fila de revisão',
        description: [
          '`status=GERADO` é o que a máquina escreveu e ninguém leu ainda.',
          '',
          '`semQrcode=true` separa as páginas que sairão sem o quadrado do QR —',
          'o canal do YouTube só começou a transmitir em 2020, e de lá para trás',
          'não há vídeo para apontar.',
        ].join('\n'),
        security: comLogin,
        parameters: parametrosDeQuery(filtroDevocionais),
        responses: { 200: respostaJson('Página da fila', R.listaDeDevocionais), ...SEM_SESSAO },
      },
    },

    '/devocionais/{id}': {
      get: {
        tags: ['Devocionais'],
        summary: 'Um devocional, com a resenha de origem e as suspeitas',
        description:
          'As suspeitas vêm junto de propósito: quem abre esta tela é quem decide se a citação está certa, e pedir isso numa segunda chamada faria a conferência ser esquecida.',
        security: comLogin,
        parameters: [idNaRota],
        responses: {
          200: respostaJson('O devocional', R.devocionalCompleto),
          404: respostaErro('Devocional não encontrado'),
          ...SEM_SESSAO,
        },
      },
      patch: {
        tags: ['Devocionais'],
        summary: 'Aplica a correção do pastor',
        description: [
          'Marca **REVISADO**, porque quem digita aqui está transcrevendo a',
          'revisão dele. `manterStatus: true` serve ao conserto de digitação,',
          'que não é aprovação.',
          '',
          'Trocar a `referencia` **re-resolve o versículo na ACF** — sem isso a',
          'página ficaria com o texto de um versículo sob a citação de outro.',
          '',
          'As regras de tamanho são as mesmas da geração: são a página A5',
          'impressa, e não mudam conforme quem escreve.',
        ].join('\n'),
        security: protegida,
        parameters: [idNaRota],
        requestBody: corpo(correcaoDeDevocional),
        responses: { 200: respostaJson('Corrigido', R.devocionalCorrigido), ...ERROS_DE_ESCRITA },
      },
    },

    '/devocionais/{id}/aprovar': {
      post: {
        tags: ['Devocionais'],
        summary: 'Aprova sem mexer no texto',
        description:
          '`?desfazer=true` devolve a GERADO. Existe porque aprovação errada acontece, e REVISADO também é o que protege o texto da regeração — marcar por engano travaria a página no lugar errado.',
        security: protegida,
        parameters: [
          idNaRota,
          { name: 'desfazer', in: 'query', required: false, schema: { type: 'string', enum: ['true', 'false'] } },
        ],
        responses: { 200: respostaJson('Aprovado', R.devocionalAprovado), ...ERROS_DE_ESCRITA },
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
        security: comLogin,
        parameters: parametrosDeQuery(filtroPendentes),
        responses: { 200: respostaJson('Página da fila', R.listaDePendentes), ...SEM_SESSAO },
      },
    },

    '/resenhas': {
      get: {
        tags: ['Resenhas'],
        summary: 'Listagem',
        security: comLogin,
        parameters: parametrosDeQuery(filtroListagem),
        responses: { 200: respostaJson('Página de resenhas', R.listaDeResenhas), ...SEM_SESSAO },
      },
    },

    '/resenhas/{id}': {
      get: {
        tags: ['Resenhas'],
        summary: 'Uma resenha, com culto, classificação e devocional',
        security: comLogin,
        parameters: [idNaRota],
        responses: { 200: respostaJson('A resenha', R.resenhaCompleta), 404: respostaErro('Resenha não encontrada'), ...SEM_SESSAO },
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
        responses: { 200: respostaJson('Resenha corrigida', R.resenhaCompleta), ...ERROS_DE_ESCRITA },
      },
    },

    '/sessao/login': {
      post: {
        tags: ['Sessão'],
        summary: 'Entra e recebe o token de sessão',
        description:
          'A resposta é a mesma para e-mail inexistente, senha errada e conta inativa: dizer qual dos três falhou entregaria quais e-mails existem.',
        requestBody: corpo(credenciais),
        responses: { 200: respostaJson('Token e dados do usuário', R.login), 401: respostaErro('E-mail ou senha inválidos') },
      },
    },

    '/sessao/eu': {
      get: {
        tags: ['Sessão'],
        summary: 'Quem sou eu',
        security: protegida,
        responses: { 200: respostaJson('O usuário da sessão', R.eu), 401: respostaErro('Faça login') },
      },
    },

    '/analise/panorama': {
      get: { tags: ['Análise'], summary: 'Números do acervo', security: comLogin, responses: { 200: respostaJson('Panorama', R.panorama), ...SEM_SESSAO } },
    },
    '/analise/doutrinas': {
      get: {
        tags: ['Análise'],
        summary: 'Distribuição por doutrina',
        description: 'Só o tema PRINCIPAL conta; somar os secundários faria o total passar do número de pregações.',
        security: comLogin,
        responses: { 200: respostaJson('As 8 doutrinas com contagem e percentual', R.porDoutrina), ...SEM_SESSAO },
      },
    },
    '/analise/evolucao': {
      get: {
        tags: ['Análise'],
        summary: 'Ênfase doutrinária ano a ano',
        description: 'Usa apenas data de origem TEXTO, para a série histórica não misturar o que é firme com o que foi inferido.',
        security: comLogin,
        responses: { 200: respostaJson('Série por ano', R.evolucao), ...SEM_SESSAO },
      },
    },
    '/analise/pregadores': {
      get: {
        tags: ['Análise'],
        summary: 'O que cada pregador enfatiza',
        security: comLogin,
        parameters: parametrosDeQuery(filtroPregadores),
        responses: { 200: respostaJson('Perfil por pregador', R.perfilDePregadores), ...SEM_SESSAO },
      },
    },
    '/analise/biblia': {
      get: {
        tags: ['Análise'],
        summary: 'Cobertura bíblica',
        description: 'A pergunta interessante não é qual livro aparece mais, e sim qual nunca apareceu — por isso os 66 vêm sempre.',
        security: comLogin,
        responses: { 200: respostaJson('Cobertura, mais pregados e nunca pregados', R.cobertura), ...SEM_SESSAO },
      },
    },

    '/livro/paginas': {
      get: {
        tags: ['Livro'],
        summary: 'As páginas do livro, em JSON',
        security: comLogin,
        parameters: parametrosDeQuery(filtroLivro),
        responses: { 200: respostaJson('Páginas montadas', R.paginasDoLivro), ...SEM_SESSAO },
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
        security: comLogin,
        parameters: parametrosDeQuery(filtroLivro),
        responses: { 200: { description: 'Pacote IDML', content: { 'application/vnd.adobe.indesign-idml-package': { schema: { type: 'string', format: 'binary' } } } }, ...SEM_SESSAO },
      },
    },

    '/cultos': {
      get: {
        tags: ['Cultos'],
        summary: 'Listagem de cultos',
        description: 'Filtra por ano, turno, natureza e presença de vídeo.',
        security: comLogin,
        parameters: parametrosDeQuery(filtroCultos),
        responses: { 200: respostaJson('Página de cultos', R.listaDeCultos), ...SEM_SESSAO },
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
        security: comLogin,
        responses: { 200: respostaJson('Todos os pregadores', R.listaDePregadores), ...SEM_SESSAO },
      },
      post: {
        tags: ['Pregadores'],
        summary: 'Cadastra',
        description: 'O nome canônico entra automaticamente como alias.',
        security: protegida,
        requestBody: corpo(novoPregador),
        responses: { 201: respostaJson('Cadastrado', R.pregadorCriado), ...ERROS_DE_ESCRITA },
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
        responses: { 200: respostaJson('Fundido', R.fusaoFeita), ...ERROS_DE_ESCRITA },
      },
    },
  },
};
