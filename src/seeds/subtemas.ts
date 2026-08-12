import connection from '../connection';
import { logSuccess } from '../utils/logger';

/**
 * Os 57 capítulos da Teologia Sistemática de Wayne Grudem, cada um sob a
 * doutrina que cobre.
 *
 * Os títulos em inglês vêm da relação de aulas publicada pelo próprio autor em
 * waynegrudem.com — é a fonte autoritativa da numeração. Os nomes em português
 * usam a terminologia teológica corrente.
 *
 * A obra tem 7 partes; este projeto usa 8 doutrinas, separando Cristo do
 * Espírito Santo. Por isso os capítulos 30, 39, 52 e 53, que na obra estão em
 * outras partes, ficam sob a Doutrina do Espírito Santo: distinguir
 * cristologia de pneumatologia importa para ler o que a igreja tem pregado.
 */

type Capitulo = {
  capitulo: number;
  nome: string;
  original: string;
  /** numero da doutrina, de 1 a 8 */
  doutrina: number;
};

export const CAPITULOS: Capitulo[] = [
  // 1 — Doutrina da Palavra de Deus (partes 1 da obra)
  { capitulo: 1, doutrina: 1, nome: 'Introdução à Teologia Sistemática', original: 'Introduction to Systematic Theology' },
  { capitulo: 2, doutrina: 1, nome: 'A Palavra de Deus e suas formas', original: 'The Word of God: What are the different forms of the Word of God?' },
  { capitulo: 3, doutrina: 1, nome: 'O Cânon das Escrituras', original: 'The Canon of Scripture' },
  { capitulo: 4, doutrina: 1, nome: 'Autoridade das Escrituras', original: 'The Four Characteristics of Scripture (#1 – Authority)' },
  { capitulo: 5, doutrina: 1, nome: 'Inerrância das Escrituras', original: 'The Inerrancy of Scripture' },
  { capitulo: 6, doutrina: 1, nome: 'Clareza das Escrituras', original: 'The Four Characteristics of Scripture (#2 – Clarity)' },
  { capitulo: 7, doutrina: 1, nome: 'Necessidade das Escrituras', original: 'The Four Characteristics of Scripture (#3 – Necessity)' },
  { capitulo: 8, doutrina: 1, nome: 'Suficiência das Escrituras', original: 'The Four Characteristics of Scripture (#4 – Sufficiency)' },

  // 2 — Doutrina de Deus
  { capitulo: 9, doutrina: 2, nome: 'A Existência de Deus', original: 'The Doctrine of God – The Existence of God' },
  { capitulo: 10, doutrina: 2, nome: 'A Cognoscibilidade de Deus', original: 'The Knowability of God' },
  { capitulo: 11, doutrina: 2, nome: 'Atributos Incomunicáveis de Deus', original: 'The Character of God – "Incommunicable" Attributes' },
  { capitulo: 12, doutrina: 2, nome: 'Atributos Comunicáveis de Deus', original: 'The Character of God – "Communicable" Attributes' },
  { capitulo: 13, doutrina: 2, nome: 'Atributos Comunicáveis de Deus (continuação)', original: 'The Character of God: "Communicable" Attributes of God' },
  { capitulo: 14, doutrina: 2, nome: 'A Trindade', original: 'The Trinity' },
  { capitulo: 15, doutrina: 2, nome: 'A Criação', original: 'The Doctrine of Creation' },
  { capitulo: 16, doutrina: 2, nome: 'A Providência de Deus', original: "God's Providence" },
  { capitulo: 17, doutrina: 2, nome: 'Milagres', original: 'Doctrine of Miracles' },
  { capitulo: 18, doutrina: 2, nome: 'Oração', original: 'Doctrine of Prayer' },
  { capitulo: 19, doutrina: 2, nome: 'Anjos', original: 'Doctrine of Angels' },
  { capitulo: 20, doutrina: 2, nome: 'Satanás e Demônios', original: 'Doctrine of Satan and Demons' },

  // 3 — Doutrina do Homem
  { capitulo: 21, doutrina: 3, nome: 'A Criação do Homem à Imagem de Deus', original: 'Doctrine of Man – Creation of Man in the Image of God' },
  { capitulo: 22, doutrina: 3, nome: 'Homem e Mulher na Criação e no Casamento', original: 'Doctrine of Man – Manhood and Womanhood in Creation and Marriage' },
  { capitulo: 23, doutrina: 3, nome: 'A Natureza Essencial do Homem', original: 'Doctrine of Man – The Essential Nature of Man' },
  { capitulo: 24, doutrina: 3, nome: 'O Pecado', original: 'Doctrine of Sin' },
  { capitulo: 25, doutrina: 3, nome: 'As Alianças entre Deus e o Homem', original: 'Doctrine of Covenants: Covenants Between God and Man' },

  // 4 — Doutrina de Cristo
  { capitulo: 26, doutrina: 4, nome: 'A Pessoa de Cristo: verdadeiro Deus e verdadeiro homem', original: 'Jesus: Fully God and fully man in one person' },
  { capitulo: 27, doutrina: 4, nome: 'A Expiação', original: 'Doctrine of the Atonement' },
  { capitulo: 28, doutrina: 4, nome: 'A Ressurreição e a Ascensão', original: 'Doctrine of the Resurrection' },
  { capitulo: 29, doutrina: 4, nome: 'Os Ofícios de Cristo: Profeta, Sacerdote e Rei', original: 'The Offices of Christ: Prophet, Priest, and King' },

  // 6 — Doutrina do Espírito Santo (na obra ficam em outras partes)
  { capitulo: 30, doutrina: 6, nome: 'A Obra do Espírito Santo', original: 'Doctrine of the Holy Spirit' },

  // 5 — Doutrina da Salvação
  { capitulo: 31, doutrina: 5, nome: 'A Graça Comum', original: 'Doctrine of Common Grace' },
  { capitulo: 32, doutrina: 5, nome: 'Eleição e Reprovação', original: 'Doctrine of Election and Reprobation' },
  { capitulo: 33, doutrina: 5, nome: 'O Chamado do Evangelho e o Chamado Eficaz', original: 'The Gospel Call and Effective Calling' },
  { capitulo: 34, doutrina: 5, nome: 'Regeneração', original: 'Doctrine of Regeneration' },
  { capitulo: 35, doutrina: 5, nome: 'Conversão: arrependimento e fé', original: 'Doctrine of Conversion' },
  { capitulo: 36, doutrina: 5, nome: 'Justificação', original: 'Doctrine of Justification' },
  { capitulo: 37, doutrina: 5, nome: 'Adoção', original: 'Doctrine of Adoption' },
  { capitulo: 38, doutrina: 5, nome: 'Santificação', original: 'Doctrine of Sanctification' },
  { capitulo: 39, doutrina: 6, nome: 'Batismo e Plenitude do Espírito Santo', original: 'Baptism in and Filling with the Holy Spirit' },
  { capitulo: 40, doutrina: 5, nome: 'Perseverança dos Santos', original: 'Perseverance of the Saints' },
  { capitulo: 41, doutrina: 5, nome: 'A Morte e o Estado Intermediário', original: 'Death and the Intermediate State' },
  { capitulo: 42, doutrina: 5, nome: 'Glorificação', original: 'Doctrine of Glorification' },
  { capitulo: 43, doutrina: 5, nome: 'União com Cristo', original: 'Union with Christ' },

  // 7 — Doutrina da Igreja
  { capitulo: 44, doutrina: 7, nome: 'A Igreja: natureza, marcas e propósitos', original: 'The Church: Its Nature, Marks, and Purposes' },
  { capitulo: 45, doutrina: 7, nome: 'A Igreja: natureza, marcas e propósitos (continuação)', original: 'The Church: Its Nature, Marks, and Purposes (cont.)' },
  { capitulo: 46, doutrina: 7, nome: 'O Poder da Igreja e a Disciplina Eclesiástica', original: 'The Power of the Church and Church Discipline' },
  { capitulo: 47, doutrina: 7, nome: 'O Governo da Igreja', original: 'Church Government' },
  { capitulo: 48, doutrina: 7, nome: 'Os Meios de Graça na Igreja', original: 'Means of Grace Within the Church' },
  { capitulo: 49, doutrina: 7, nome: 'O Batismo', original: 'Baptism' },
  { capitulo: 50, doutrina: 7, nome: 'A Ceia do Senhor', original: "The Lord's Supper" },
  { capitulo: 51, doutrina: 7, nome: 'A Adoração', original: 'Worship' },
  { capitulo: 52, doutrina: 6, nome: 'Os Dons do Espírito Santo', original: 'Gifts of the Holy Spirit' },
  { capitulo: 53, doutrina: 6, nome: 'Os Dons do Espírito Santo: profecia', original: 'Gifts of the Holy Spirit, Prophecy' },

  // 8 — Doutrina das Últimas Coisas
  { capitulo: 54, doutrina: 8, nome: 'O Retorno de Cristo', original: 'Introduction to The Return of Christ' },
  { capitulo: 55, doutrina: 8, nome: 'O Milênio', original: 'The Millennium: Amillennial and Postmillennial views' },
  { capitulo: 56, doutrina: 8, nome: 'O Juízo Final e o Castigo Eterno', original: 'The Final Judgment and Eternal Punishment' },
  { capitulo: 57, doutrina: 8, nome: 'Os Novos Céus e a Nova Terra', original: 'The New Heavens and New Earth' },
];

export async function semearSubtemas() {
  const doutrinas = await connection.doutrina.findMany({ select: { id: true, numero: true } });
  const porNumero = new Map(doutrinas.map((d) => [d.numero, d.id]));

  for (const capitulo of CAPITULOS) {
    const doutrinaId = porNumero.get(capitulo.doutrina);
    if (!doutrinaId) throw new Error(`Doutrina ${capitulo.doutrina} não existe — rode o seed antes`);

    await connection.subtema.upsert({
      where: { capituloGrudem: capitulo.capitulo },
      update: { nome: capitulo.nome, nomeOriginal: capitulo.original, doutrinaId },
      create: {
        capituloGrudem: capitulo.capitulo,
        nome: capitulo.nome,
        nomeOriginal: capitulo.original,
        doutrinaId,
      },
    });
  }

  logSuccess(`${CAPITULOS.length} capítulos de Grudem mapeados nas 8 doutrinas`, 'classificacao');
}
