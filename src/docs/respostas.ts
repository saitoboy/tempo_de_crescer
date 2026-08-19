import { z } from 'zod';

/**
 * O formato do que cada rota devolve.
 *
 * Sem isto, o `openapi.json` declarava só `description` em cada 200, e o
 * `openapi-typescript` gerava `content?: never` — o front tirava dali o tipo do
 * **corpo da requisição** e mais nada, e precisava de um `esquemas.ts` escrito à
 * mão para o resto. Duas fontes para o mesmo contrato, uma delas sem ninguém
 * verificando.
 *
 * Os esquemas de entrada moram junto das rotas, porque lá eles **validam**. Os
 * de saída moram aqui porque são descrição: descrevem o que os `select` do
 * Prisma já montam. Isso tem um custo honesto — mudar um `select` e esquecer
 * daqui faz a documentação mentir, e nenhum teste pega. Onde a forma é
 * arriscada de errar (a página do livro, o candidato da curadoria), o tipo do
 * serviço é a referência e o teste `respostas.test.ts` compara os dois.
 *
 * `.meta({ description })` vira `description` no JSON Schema — é como o
 * comentário chega ao Swagger e ao tipo gerado.
 */

/** Data de calendário, sem hora: o que o Prisma serializa de um `DateTime`. */
const dataHora = z.iso.datetime();
const dataOuNulo = z.iso.datetime().nullable();

const turno = z.enum(['DIA', 'NOITE']);
const natureza = z.enum(['CULTO', 'CELEBRACAO', 'EBD', 'ESTUDO', 'VIGILIA', 'CONFERENCIA', 'FUNEBRE']);
const tipoPregador = z.enum(['PASTOR', 'SEMINARISTA', 'CONVIDADO', 'IRMAO']);
const papel = z.enum(['ADMIN', 'PASTOR', 'LIDER']);

// ──────────────────────────────────────────────────────────────────────────────
// PEDAÇOS REAPROVEITADOS
// ──────────────────────────────────────────────────────────────────────────────

const pregadorResumido = z.object({
  id: z.uuid(),
  nomeCanonico: z.string(),
});

const cultoResumido = z.object({
  data: dataHora,
  turno,
  natureza,
});

/** Envelope de qualquer listagem paginada. */
function paginado<T extends z.ZodType>(campo: string, item: T) {
  return z.object({
    total: z.int(),
    pagina: z.int(),
    porPagina: z.int(),
    paginas: z.int(),
    [campo]: z.array(item),
  });
}

// ──────────────────────────────────────────────────────────────────────────────
// SAÚDE E META
// ──────────────────────────────────────────────────────────────────────────────

export const saude = z.object({
  ok: z.boolean(),
  resenhas: z.int(),
  cultos: z.int(),
  pregadores: z.int(),
});

const opcao = z.object({
  valor: z.string(),
  rotulo: z.string().meta({ description: 'Como exibir na tela, já em português' }),
});

export const meta = z
  .object({
    turnos: z.array(opcao),
    naturezas: z.array(opcao),
    origensDeData: z.array(opcao),
    origensDePregador: z.array(opcao),
    tiposDePregador: z.array(opcao),
    statusDeResenha: z.array(opcao),
    statusDeDevocional: z.array(opcao),
    papeisDeDoutrina: z.array(opcao),
    papeisDeUsuario: z.array(opcao),
    doutrinas: z.array(
      z.object({
        id: z.uuid(),
        numero: z.int(),
        nome: z.string(),
        perguntaCentral: z.string(),
      }),
    ),
  })
  .meta({ description: 'O vocabulário do domínio, para o front não copiar enum à mão' });

// ──────────────────────────────────────────────────────────────────────────────
// SESSÃO
// ──────────────────────────────────────────────────────────────────────────────

const usuario = z.object({
  id: z.uuid(),
  nome: z.string(),
  email: z.email(),
  papel,
});

export const login = z.object({
  token: z.string().meta({ description: 'Mandar em Authorization: Bearer <token>' }),
  expiraEmHoras: z.int(),
  usuario,
});

export const eu = usuario.extend({ ativo: z.boolean() }).nullable();

// ──────────────────────────────────────────────────────────────────────────────
// RESENHAS
// ──────────────────────────────────────────────────────────────────────────────

const resenhaDaLista = z.object({
  id: z.uuid(),
  slug: z.string(),
  titulo: z.string(),
  dataPregacao: dataOuNulo,
  ano: z.int(),
  textoBase: z.string().nullable(),
  pregador: pregadorResumido.nullable(),
  culto: cultoResumido.nullable(),
});

export const listaDeResenhas = paginado('resenhas', resenhaDaLista);

const pendente = z.object({
  id: z.uuid(),
  titulo: z.string(),
  ano: z.int(),
  urlBlog: z.url(),
  dataPregacao: dataOuNulo,
  pregador: pregadorResumido.nullable(),
  pregadorBruto: z.string().nullable().meta({ description: 'O que a assinatura dizia, sem resolver' }),
});

export const listaDePendentes = paginado('resenhas', pendente);

const doutrina = z.object({
  id: z.uuid(),
  numero: z.int(),
  nome: z.string(),
  perguntaCentral: z.string(),
});

const devocional = z.object({
  id: z.uuid(),
  resenhaId: z.uuid(),
  titulo: z.string(),
  referencia: z.string().nullable(),
  versiculo: z.string().nullable(),
  reflexao: z.string(),
  pontosAplicacao: z.array(z.string()),
  oracao: z.string().nullable(),
  status: z.enum(['GERADO', 'REVISADO']),
  modelo: z.string().nullable(),
  geradoEm: dataHora,
});

export const resenhaCompleta = z
  .object({
    id: z.uuid(),
    slug: z.string(),
    urlBlog: z.url(),
    titulo: z.string(),
    dataPregacao: dataOuNulo,
    ano: z.int(),
    conteudoLimpo: z.string(),
    textoBase: z.string().nullable(),
    redator: z.string().nullable(),
    status: z.enum(['INGERIDA', 'CLASSIFICADA', 'REVISADA']),
    pregador: pregadorResumido.extend({ tipo: tipoPregador }).nullable(),
    culto: z
      .object({
        id: z.uuid(),
        data: dataHora,
        turno,
        natureza,
        youtubeUrl: z.url().nullable(),
        qrcodeSvg: z.string().nullable(),
      })
      .nullable(),
    classificacoes: z.array(
      z.object({
        papel: z.enum(['PRINCIPAL', 'SECUNDARIO']),
        zscore: z.number(),
        densidade: z.number(),
        doutrina,
      }),
    ),
    devocional: devocional.nullable(),
  })
  .meta({
    description:
      'Vem do `include` do Prisma, então traz também os campos crus da resenha (conteudoBruto, publicadoEm e afins) que a tela não usa.',
  });

// ──────────────────────────────────────────────────────────────────────────────
// PREGADORES
// ──────────────────────────────────────────────────────────────────────────────

export const listaDePregadores = z.array(
  z.object({
    id: z.uuid(),
    nomeCanonico: z.string(),
    tipo: tipoPregador,
    aliases: z.array(z.string()),
    resenhas: z.int().meta({ description: 'Quantas resenhas estão atribuídas a ele' }),
  }),
);

export const pregadorCriado = z.object({
  id: z.uuid(),
  nomeCanonico: z.string(),
  tipo: tipoPregador,
  aliases: z.array(z.string()),
});

export const fusaoFeita = z.object({
  status: z.literal('ok'),
  mensagem: z.string(),
  resenhasMovidas: z.int(),
});

// ──────────────────────────────────────────────────────────────────────────────
// CULTOS
// ──────────────────────────────────────────────────────────────────────────────

export const listaDeCultos = paginado(
  'cultos',
  z.object({
    id: z.uuid(),
    data: dataHora,
    turno,
    natureza,
    youtubeUrl: z.url().nullable(),
    youtubeVideoId: z.string().nullable(),
    tituloLive: z.string().nullable(),
    qrcode: z.string().nullable().meta({ description: 'O SVG como data URI, pronto para <img src>' }),
    resenhas: z.int(),
  }),
);

// ──────────────────────────────────────────────────────────────────────────────
// ANÁLISE
// ──────────────────────────────────────────────────────────────────────────────

export const panorama = z.object({
  resenhas: z.int(),
  cultos: z.int(),
  cultosComVideo: z.int(),
  pregadores: z.int(),
  devocionais: z.int(),
  classificadas: z.int(),
  periodo: z.object({ de: z.int().nullable(), ate: z.int().nullable() }),
  revisaoPendente: z.object({ semPregador: z.int(), semData: z.int() }),
});

export const porDoutrina = z.object({
  total: z.int(),
  doutrinas: z.array(
    z.object({
      numero: z.int(),
      nome: z.string(),
      perguntaCentral: z.string(),
      pregacoes: z.int(),
      percentual: z.number(),
    }),
  ),
});

export const evolucao = z.array(
  z.object({
    ano: z.int(),
    total: z.int(),
    doutrinas: z.record(z.string(), z.int()).meta({ description: 'Nome da doutrina para número de pregações' }),
  }),
);

export const perfilDePregadores = z.array(
  z.object({
    pregador: z.string(),
    tipo: tipoPregador,
    total: z.int(),
    enfase: z.string().nullable().meta({ description: 'A doutrina que mais aparece como tema principal dele' }),
    doutrinas: z.record(z.string(), z.int()),
  }),
);

export const cobertura = z.object({
  livrosCobertos: z.int(),
  livrosTotais: z.int(),
  percentual: z.number(),
  nuncaPregados: z.array(z.string()).meta({ description: 'A pergunta que interessa: o que nunca subiu ao púlpito' }),
  maisPregados: z.array(z.object({ nome: z.string(), pregacoes: z.int() })),
  livros: z.array(z.object({ nome: z.string(), pregacoes: z.int() })),
});

// ──────────────────────────────────────────────────────────────────────────────
// LIVRO
// ──────────────────────────────────────────────────────────────────────────────

export const paginaDoLivro = z.object({
  devocionalId: z.uuid(),
  titulo: z.string(),
  versiculo: z.string().nullable(),
  referencia: z.string().nullable(),
  data: z.string().nullable(),
  pregador: z.string().nullable(),
  reflexao: z.array(z.string()).meta({ description: 'Um item por parágrafo' }),
  pontosAplicacao: z.array(z.string()),
  oracao: z.string().nullable(),
  qrcodeSvg: z.string().nullable(),
  youtubeUrl: z.url().nullable(),
  redator: z.string().nullable().meta({ description: 'Quem redigiu a resenha de origem, creditado no livro' }),
});

export const paginasDoLivro = z.array(paginaDoLivro);

// ──────────────────────────────────────────────────────────────────────────────
// TEMAS DO MÊS
// ──────────────────────────────────────────────────────────────────────────────

const temaResumido = z.object({
  id: z.uuid(),
  ano: z.int(),
  mes: z.int(),
  tema: z.string(),
  descricao: z.string().nullable(),
  versiculo: z.string().nullable(),
  referencia: z.string().nullable(),
  doutrina: z.object({ id: z.uuid(), numero: z.int(), nome: z.string() }).nullable(),
  paginas: z.int().meta({ description: 'Quantos devocionais já foram escolhidos para o mês' }),
});

export const listaDeTemas = z.array(temaResumido);

export const temaCompleto = temaResumido.extend({
  paginas: z.array(
    z.object({
      ordem: z.int(),
      devocionalId: z.uuid(),
      titulo: z.string(),
      referencia: z.string().nullable(),
      data: z.string().nullable(),
      pregador: z.string().nullable(),
    }),
  ),
});

export const candidatos = z.array(
  z.object({
    id: z.uuid(),
    titulo: z.string(),
    referencia: z.string().nullable(),
    data: z.string().nullable(),
    pregador: z.string().nullable(),
    doutrina: z.string().nullable(),
    zscore: z.number().nullable(),
    afinidade: z
      .number()
      .nullable()
      .meta({
        description:
          'De 0 a 100, e **relativo ao conjunto devolvido**: o melhor da busca vira 100. Só na busca semântica. O cosseno cru se agrupa entre 85% e 90% e não distinguiria nada.',
      }),
    jaUsadoEm: z.string().nullable().meta({ description: 'Em qual mês já foi usado, se já foi' }),
  }),
);

export const temaSalvo = temaResumido.partial().extend({ id: z.uuid() });

/** Resposta de operação que não devolve corpo, como remover página do mês. */
export const confirmacao = z.object({ status: z.literal('ok') });

// ──────────────────────────────────────────────────────────────────────────────
// REVISÃO DOS DEVOCIONAIS
// ──────────────────────────────────────────────────────────────────────────────

/** O que a conferência contra a ACF achou. Lista vazia é aprovação. */
const suspeita = z.object({
  trecho: z.string(),
  motivo: z.enum(['nao-esta-na-escritura', 'referencia-nao-existe']).meta({
    description:
      'A conferência é literal, contra a ACF. Ela NÃO distingue invenção de citação em outra tradução — os números se cruzam — então é sinal para o revisor olhar, não veredito.',
  }),
});

export const listaDeDevocionais = paginado(
  'devocionais',
  z.object({
    id: z.uuid(),
    titulo: z.string(),
    referencia: z.string().nullable(),
    status: z.enum(['GERADO', 'REVISADO']),
    modelo: z.string().nullable(),
    geradoEm: dataHora,
    resenhaId: z.uuid(),
    resenha: z.string(),
    dataPregacao: dataOuNulo,
    temQrcode: z.boolean().meta({ description: 'Sem QR a página sai sem o quadrado — triagem, não defeito' }),
  }),
);

export const devocionalCompleto = devocional.extend({
  suspeitas: z.array(suspeita),
  resenha: z.object({
    id: z.uuid(),
    titulo: z.string(),
    dataPregacao: dataOuNulo,
    conteudoLimpo: z.string().meta({ description: 'A pregação de origem, para conferir o que foi dito' }),
    pregador: z.object({ nomeCanonico: z.string() }).nullable(),
    culto: z.object({ youtubeUrl: z.url().nullable(), qrcodeSvg: z.string().nullable() }).nullable(),
  }),
});

export const devocionalCorrigido = z.object({
  id: z.uuid(),
  status: z.enum(['GERADO', 'REVISADO']),
  suspeitas: z.array(suspeita),
});

export const devocionalAprovado = z.object({
  id: z.uuid(),
  titulo: z.string(),
  status: z.enum(['GERADO', 'REVISADO']),
});

// ──────────────────────────────────────────────────────────────────────────────
// CHAVES DE API
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Note o que **não** está aqui: o valor da chave.
 *
 * Ela entra uma vez e não sai mais. A tela identifica pelo rótulo e pelos
 * quatro últimos caracteres; quem precisar do valor de novo cadastra outra
 * chave, que é mais barato que abrir um caminho de vazamento.
 */
const chaveDeApi = z.object({
  id: z.uuid(),
  provedor: z.enum(['GROQ', 'NVIDIA']),
  rotulo: z.string().meta({ description: 'Como a pessoa reconhece esta chave. Não é segredo.' }),
  final: z.string().meta({ description: 'Os quatro últimos caracteres, para identificar sem revelar' }),
  ativa: z.boolean(),
  ultimoErro: z.string().nullable(),
  ultimoErroEm: dataOuNulo,
  usadaEm: dataOuNulo,
  criadaEm: dataHora,
});

export const listaDeChaves = z.array(chaveDeApi);
export const chaveGuardada = chaveDeApi;
