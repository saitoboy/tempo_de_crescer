import connection from '../connection';
import { logSuccess } from '../utils/logger';

/**
 * Os temas mensais sugeridos pela igreja.
 *
 * Vários puxam uma das 8 doutrinas e ficam ligados a ela, o que faz o sistema
 * sugerir devocionais candidatos pela classificação. Outros — Família, Novas
 * Gerações, As mulheres da Bíblia — são recortes pastorais que não mapeiam em
 * doutrina nenhuma, e a escolha ali é inteiramente manual.
 *
 * O ano é parâmetro: os mesmos temas servem de ponto de partida para qualquer
 * edição, e cada uma pode ser ajustada depois pela API.
 */
const TEMAS: Array<{ mes: number; tema: string; descricao?: string; doutrina?: number }> = [
  { mes: 1, tema: 'Expectativas e Novos Recomeços', descricao: 'A virada do ano e o que se espera de Deus.' },
  { mes: 2, tema: 'Santificação e Encontros com Jesus', descricao: 'Arrependimento e separação para Deus, no tempo do carnaval.', doutrina: 5 },
  { mes: 3, tema: 'As Mulheres da Bíblia', descricao: 'Protagonismo feminino nas Escrituras.' },
  { mes: 4, tema: 'Páscoa', descricao: 'A redenção pela cruz e pela ressurreição.', doutrina: 4 },
  { mes: 5, tema: 'Família', descricao: 'A casa como lugar de fé.' },
  { mes: 6, tema: 'Escatologia', descricao: 'Para onde caminha a história.', doutrina: 8 },
  { mes: 7, tema: 'Novas Gerações', descricao: 'A fé transmitida aos que vêm depois.' },
  { mes: 8, tema: 'Eclesiologia', descricao: 'O que significa viver como corpo de Cristo.', doutrina: 7 },
  { mes: 9, tema: 'Missiologia', descricao: 'A igreja enviada.', doutrina: 7 },
  { mes: 10, tema: 'Cristologia', descricao: 'Quem é Jesus e qual é o Seu papel.', doutrina: 4 },
  { mes: 11, tema: 'Mordomia', descricao: 'O que fazemos com o que recebemos.', doutrina: 3 },
  { mes: 12, tema: 'Entrega e Redenção', descricao: 'A encarnação e o que ela pede de nós.', doutrina: 4 },
];

export async function semearTemas(ano: number) {
  const doutrinas = await connection.doutrina.findMany({ select: { id: true, numero: true } });
  const porNumero = new Map(doutrinas.map((d) => [d.numero, d.id]));

  for (const t of TEMAS) {
    const doutrinaId = t.doutrina ? porNumero.get(t.doutrina) : null;
    await connection.temaMes.upsert({
      where: { ano_mes: { ano, mes: t.mes } },
      update: { tema: t.tema, descricao: t.descricao, doutrinaId },
      create: { ano, mes: t.mes, tema: t.tema, descricao: t.descricao, doutrinaId },
    });
  }

  logSuccess(`${TEMAS.length} temas mensais de ${ano}`, 'livro');
}
