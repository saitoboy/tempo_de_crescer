import connection from '../connection';
import { TipoPregador } from '../generated/prisma/enums';
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
  { nomeCanonico: 'Jaine Feliciano', tipo: 'IRMAO', aliases: ['jaine feliciano', 'missionária jaine', 'missionaria jaine', 'jaine'] },
];

async function main() {
  for (const doutrina of DOUTRINAS) {
    await connection.doutrina.upsert({
      where: { numero: doutrina.numero },
      update: { nome: doutrina.nome, perguntaCentral: doutrina.perguntaCentral },
      create: doutrina,
    });
  }
  console.log(`✓ ${DOUTRINAS.length} doutrinas`);

  for (const pregador of PREGADORES) {
    await connection.pregador.upsert({
      where: { nomeCanonico: pregador.nomeCanonico },
      update: { tipo: pregador.tipo, aliases: pregador.aliases },
      create: pregador,
    });
  }
  console.log(`✓ ${PREGADORES.length} pregadores`);

  await criarAdmin();
}

/**
 * Cria o usuário administrador a partir do .env. Nunca sobrescreve a senha de
 * um admin que já existe — rodar o seed de novo não reseta credencial.
 */
async function criarAdmin() {
  const email = process.env.ADMIN_EMAIL;
  const senha = process.env.ADMIN_SENHA;

  if (!email || !senha) {
    console.log('- ADMIN_EMAIL/ADMIN_SENHA não definidos no .env, admin não criado');
    return;
  }

  const existente = await connection.usuario.findUnique({ where: { email } });
  if (existente) {
    console.log(`- admin ${email} já existe, mantido como está`);
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
  console.log(`✓ admin ${email}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => connection.$disconnect());
