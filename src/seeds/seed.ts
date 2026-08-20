import connection from '../connection';
import { TipoPregador } from '../generated/prisma/enums';
import { logInfo, logSuccess, logWarning } from '../utils/logger';
import { anosDaCuradoria, importarCuradoria } from './curadoria';
import { importarDevocionais } from './devocionais';
import { semearSubtemas } from './subtemas';
import { semearTemas } from './temas';
import { gerarHash } from '../utils/senha';

/**
 * Seed fixo: as 8 doutrinas da Teologia Sistemática de Wayne Grudem
 * e os pregadores conhecidos da IBPS, com os aliases que aparecem nas
 * assinaturas das resenhas.
 *
 * Idempotente — pode rodar quantas vezes quiser.
 */

const DOUTRINAS = [
  { numero: 1, nome: 'Doutrina da Palavra de Deus', perguntaCentral: 'O que esta pregação ensina sobre a Bíblia e sua autoridade?' },
  { numero: 2, nome: 'Doutrina de Deus', perguntaCentral: 'Quem Deus é, segundo esta mensagem?' },
  { numero: 3, nome: 'Doutrina do Homem', perguntaCentral: 'O que esta pregação ensina sobre a condição humana?' },
  { numero: 4, nome: 'Doutrina de Cristo', perguntaCentral: 'Quem é Jesus e qual é o Seu papel?' },
  { numero: 5, nome: 'Doutrina da Salvação', perguntaCentral: 'Como o ser humano é salvo?' },
  { numero: 6, nome: 'Doutrina do Espírito Santo', perguntaCentral: 'Como o Espírito Santo atua na vida do crente?' },
  { numero: 7, nome: 'Doutrina da Igreja', perguntaCentral: 'O que significa viver como corpo de Cristo?' },
  { numero: 8, nome: 'Doutrina das Últimas Coisas', perguntaCentral: 'Para onde caminha a história e a fé cristã?' },
];

/**
 * Aliases portados de legacy/src/services/normalizer.py.
 * Sempre minúsculos e sem título ("pastor", "seminarista") — a resolução
 * remove o título antes de comparar.
 */
const PREGADORES: Array<{ nomeCanonico: string; tipo: TipoPregador; aliases: string[] }> = [
  { nomeCanonico: 'Nélio Monteiro', tipo: 'PASTOR', aliases: ['nelio monteiro', 'nélio monteiro', 'nelio', 'nélio'] },
  { nomeCanonico: 'Gabriel Monteiro', tipo: 'PASTOR', aliases: ['gabriel monteiro', 'gabriel'] },
  { nomeCanonico: 'Ryan Souza', tipo: 'PASTOR', aliases: ['ryan sousa', 'ryan souza', 'ryan de sousa', 'ryan de souza', 'ryan'] },
  { nomeCanonico: 'Silvio Farias', tipo: 'PASTOR', aliases: ['silvio farias', 'sílvio farias', 'silvio faria', 'sílvio faria', 'silvio', 'sílvio'] },
  { nomeCanonico: 'Robson Soares', tipo: 'PASTOR', aliases: ['robson soares', 'robson'] },
  { nomeCanonico: 'Jailson', tipo: 'PASTOR', aliases: ['jailson'] },
  { nomeCanonico: 'Daniel Monteiro', tipo: 'SEMINARISTA', aliases: ['daniel monteiro', 'daniel'] },
  { nomeCanonico: 'Jaine Feliciano', tipo: 'EDUCADOR_RELIGIOSO', aliases: ['jaine feliciano', 'missionária jaine', 'missionaria jaine', 'jaine'] },

  // Nomes que o blog escreve errado, abreviado ou de mais de um jeito.
  // O nomeCanonico é o correto, confirmado pela igreja; os aliases são as
  // grafias que aparecem nas assinaturas.
  { nomeCanonico: 'Guilherme de Souza Saito', tipo: 'SEMINARISTA', aliases: ['guilherme saito', 'guilherme de souza saito', 'guilherme'] },
  { nomeCanonico: 'Fernando Arêdes', tipo: 'PASTOR', aliases: ['fernando arede', 'fernando arêde', 'fernando aredes', 'fernando arêdes'] },
  { nomeCanonico: 'Estevão Vianna', tipo: 'CONVIDADO', aliases: ['estevao vianna', 'estevão vianna', 'estevao', 'estevão', 'estevam'] },
  { nomeCanonico: 'Geovane Glória', tipo: 'CONVIDADO', aliases: ['geovane gloria', 'geovane glória', 'giovani gloria', 'giovani glória', 'geovane'] },
  { nomeCanonico: 'Luís Fernando', tipo: 'CONVIDADO', aliases: ['luis fernando', 'luís fernando', 'luiz fernando'] },
  { nomeCanonico: 'Eliel Martins', tipo: 'CONVIDADO', aliases: ['eliel martins', 'eliel marins', 'eliel'] },
  { nomeCanonico: 'Henrique Romero', tipo: 'CONVIDADO', aliases: ['henrique romero', 'henrique'] },
  { nomeCanonico: 'Áquila Cabral', tipo: 'CONVIDADO', aliases: ['aquila cabral', 'áquila cabral', 'àquila cabral', 'aquila', 'áquila', 'àquila'] },
  // O blog alterna entre "Thales" (2018, 2021) e "Thalles" (2024). Grafia
  // canônica escolhida pela maioria — confirmar com a igreja.
  { nomeCanonico: 'Thales', tipo: 'CONVIDADO', aliases: ['thales', 'thalles'] },

  // Missionários cujo lugar de origem veio grudado na assinatura do blog.
  { nomeCanonico: 'Abdulay', tipo: 'CONVIDADO', aliases: ['abdulay', 'abdulay sao tome e principe', 'abdulay são tomé e príncipe'] },
  { nomeCanonico: 'Liliane', tipo: 'CONVIDADO', aliases: ['liliane', 'liliane de passo fundo rs'] },
];

async function main() {
  for (const doutrina of DOUTRINAS) {
    await connection.doutrina.upsert({
      where: { numero: doutrina.numero },
      update: { nome: doutrina.nome, perguntaCentral: doutrina.perguntaCentral },
      create: doutrina,
    });
  }
  logSuccess(`${DOUTRINAS.length} doutrinas de Grudem prontas`, 'classificacao');

  for (const pregador of PREGADORES) {
    await connection.pregador.upsert({
      where: { nomeCanonico: pregador.nomeCanonico },
      update: { tipo: pregador.tipo, aliases: pregador.aliases },
      create: pregador,
    });
  }
  logSuccess(`${PREGADORES.length} pregadores no cadastro`, 'pregador');

  await semearSubtemas();
  // Os devocionais vêm de arquivo mesmo agora que produção consegue gerar:
  // gerar de novo produziria outro texto, e o que o pastor revisou só viaja
  // como dado. A importação nunca sobrescreve o que já está no destino.
  await importarDevocionais();
  // Depois dos devocionais, de propósito: a página aponta para um devocional,
  // e sem ele não há o que montar. E os temas do ano vêm antes da curadoria,
  // porque a página também aponta para um TemaMes que num banco novo não
  // existe. Os anos saem do próprio arquivo — semear 2028 sem livro de 2028
  // seria inventar trabalho.
  for (const ano of anosDaCuradoria()) await semearTemas(ano);
  await importarCuradoria();
  await fundirDuplicados();
  await criarAdmin();
}

/**
 * Funde num só os pregadores que o blog escreveu de mais de um jeito.
 *
 * A carga anterior cadastrou "Estevão" e "Estevam" como pessoas diferentes,
 * porque na época nenhuma era conhecida. Agora que o canônico existe com esses
 * apelidos, os registros soltos precisam ser repontados e removidos — senão
 * continuam vencendo a resolução, que casa nome canônico antes de alias.
 */
async function fundirDuplicados() {
  let fundidos = 0;

  for (const canonico of PREGADORES) {
    const destino = await connection.pregador.findUnique({
      where: { nomeCanonico: canonico.nomeCanonico },
      select: { id: true },
    });
    if (!destino) continue;

    const duplicados = await connection.pregador.findMany({
      where: {
        id: { not: destino.id },
        nomeCanonico: { in: canonico.aliases, mode: 'insensitive' },
      },
      select: { id: true, nomeCanonico: true },
    });

    for (const duplicado of duplicados) {
      const { count } = await connection.resenha.updateMany({
        where: { pregadorId: duplicado.id },
        data: { pregadorId: destino.id },
      });
      await connection.pregador.delete({ where: { id: duplicado.id } });
      logInfo(`"${duplicado.nomeCanonico}" (${count} resenhas) virou ${canonico.nomeCanonico}`, 'pregador');
      fundidos++;
    }
  }

  if (fundidos > 0) logSuccess(`${fundidos} grafias duplicadas fundidas`, 'pregador');
}

/**
 * Cria o usuário administrador a partir do .env. Nunca sobrescreve a senha de
 * um admin que já existe — rodar o seed de novo não reseta credencial.
 */
async function criarAdmin() {
  const email = process.env.ADMIN_EMAIL;
  const senha = process.env.ADMIN_SENHA;

  if (!email || !senha) {
    logWarning('sem ADMIN_EMAIL e ADMIN_SENHA no .env, nenhum administrador foi criado', 'auth');
    return;
  }

  const existente = await connection.usuario.findUnique({ where: { email } });
  if (existente) {
    logInfo(`administrador ${email} já existe, senha preservada`, 'auth');
    return;
  }

  await connection.usuario.create({
    data: {
      email,
      nome: process.env.ADMIN_NOME || 'Administrador',
      senhaHash: gerarHash(senha),
      papel: 'ADMIN',
    },
  });
  logSuccess(`administrador criado: ${email}`, 'auth');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => connection.$disconnect());
