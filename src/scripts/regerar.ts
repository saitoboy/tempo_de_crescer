import '../utils/timezone';
import 'dotenv/config';
import connection from '../connection';
import { comoPedido } from '../services/devocional';
import { escreverUm, motorDeApi, relatarGasto, type ResultadoDaEscrita } from '../services/escrita';
import { logError, logInfo, logSuccess, logWarning } from '../utils/logger';

/**
 * Reescreve devocionais que já existem.
 *
 *     npm run regerar -- groq            # todos os escritos por motor com "groq"
 *     npm run regerar -- groq 20         # só os 20 mais antigos
 *     npm run regerar -- groq --listar   # confere quais, sem escrever
 *
 * Existe porque o prompt melhora com o uso, e texto escrito com a versão antiga
 * fica pior que o do lado — no mesmo livro. Regerar 129 páginas custa minutos
 * numa API gratuita; corrigi-las à mão custa dias.
 *
 * **Nunca toca em devocional REVISADO.** Ali houve trabalho humano, e nenhuma
 * melhoria de prompt justifica jogá-lo fora. Este é o único ponto do sistema
 * que sobrescreve texto existente, e é por isso que a trava fica aqui e não no
 * serviço.
 */

async function main() {
  const filtro = process.argv[2];
  if (!filtro) {
    throw new Error('Informe o filtro de motor. Ex.: npm run regerar -- groq');
  }

  const limite = Number(process.argv[3]) || undefined;
  const soListar = process.argv.includes('--listar');

  const alvos = await connection.devocional.findMany({
    where: { modelo: { contains: filtro }, status: { not: 'REVISADO' } },
    orderBy: { geradoEm: 'asc' },
    take: limite,
    select: {
      titulo: true,
      modelo: true,
      resenha: {
        select: {
          id: true,
          titulo: true,
          conteudoLimpo: true,
          textoBase: true,
          livro: true,
          capitulo: true,
          versiculos: true,
          pregador: { select: { nomeCanonico: true } },
          classificacoes: {
            where: { papel: 'PRINCIPAL' },
            select: { doutrina: { select: { nome: true } } },
          },
        },
      },
    },
  });

  const revisados = await connection.devocional.count({
    where: { modelo: { contains: filtro }, status: 'REVISADO' },
  });

  logInfo(`${alvos.length} devocionais de "${filtro}" para reescrever`, 'devocional');
  if (revisados > 0) {
    logInfo(`${revisados} já revisados ficam intocados`, 'devocional');
  }

  if (soListar) {
    for (const [i, a] of alvos.entries()) {
      logInfo(`${String(i + 1).padStart(3)}. "${a.titulo}" ← ${a.resenha.titulo.slice(0, 50)}`, 'devocional');
    }
    logSuccess('nada reescrito, isto foi só a lista', 'devocional');
    return;
  }

  const motor = await motorDeApi();
  logInfo(`motor: ${motor.nome}`, 'devocional');

  const resultado: ResultadoDaEscrita = { escritos: 0, falhas: [], entrada: 0, saida: 0 };

  for (const [i, alvo] of alvos.entries()) {
    logInfo(`[${i + 1}/${alvos.length}] ${alvo.resenha.titulo.slice(0, 55)}`, 'devocional');

    try {
      // `sobrescrever` só aqui: é a única operação do sistema que substitui
      // texto que já existe.
      const gasto = await escreverUm(await comoPedido(alvo.resenha), motor, true);
      resultado.escritos++;
      resultado.entrada += gasto.entrada;
      resultado.saida += gasto.saida;
    } catch (e) {
      const motivo = (e as Error).message.slice(0, 200);
      resultado.falhas.push(`${alvo.resenha.titulo.slice(0, 40)}: ${motivo}`);
      // O antigo continua no banco: falhar aqui não deixa buraco, deixa o
      // texto velho. Melhor que página em branco.
      logWarning(`falhou, mantido o texto anterior: ${motivo}`, 'devocional');
    }
  }

  logSuccess(`${resultado.escritos} devocionais reescritos`, 'devocional');
  relatarGasto(resultado);

  if (resultado.falhas.length > 0) {
    logWarning(`${resultado.falhas.length} mantiveram o texto antigo`, 'devocional', resultado.falhas);
  }
}

main()
  .catch((e) => {
    logError((e as Error).message, 'devocional');
    process.exit(1);
  })
  .finally(() => connection.$disconnect());
