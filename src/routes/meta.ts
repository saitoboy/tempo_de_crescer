import { Router } from 'express';
import connection from '../connection';
import {
  NaturezaEvento,
  OrigemData,
  OrigemPregador,
  Papel,
  PapelDoutrina,
  StatusDevocional,
  StatusResenha,
  TipoPregador,
  Turno,
} from '../generated/prisma/enums';

/**
 * O vocabulário do domínio, servido pela API.
 *
 * Existe para o front não escrever `['QUARTA', 'DOMINGO_MANHA', ...]` à mão.
 * Lista copiada é lista que envelhece: acrescentar um turno no schema e
 * esquecer de acrescentar no front produz um filtro que simplesmente não
 * encontra nada, sem erro nenhum para denunciar.
 *
 * Os enums vêm do client gerado pelo Prisma, isto é, do próprio
 * `schema.prisma`. Não há terceira cópia.
 *
 * As doutrinas vêm do banco, e não de constante, porque são dado semeado —
 * têm id, número e pergunta central que o front exibe.
 */
export const rotasMeta = Router();

/** Rótulo legível de cada valor, para o front não montar `switch` de exibição. */
const ROTULOS: Record<string, string> = {
  // Turno
  DIA: 'Manhã',
  NOITE: 'Noite',

  // NaturezaEvento
  CULTO: 'Culto',
  CELEBRACAO: 'Celebração',
  EBD: 'Escola Bíblica Dominical',
  ESTUDO: 'Estudo',
  VIGILIA: 'Vigília',
  CONFERENCIA: 'Conferência',
  FUNEBRE: 'Fúnebre',

  // OrigemData e OrigemPregador
  TEXTO: 'Extraído do texto',
  YOUTUBE: 'Casado com o YouTube',
  MANUAL: 'Correção manual',
  ASSINATURA: 'Assinatura da resenha',

  // TipoPregador e Papel
  PASTOR: 'Pastor',
  SEMINARISTA: 'Seminarista',
  CONVIDADO: 'Convidado',
  IRMAO: 'Irmão',
  EDUCADOR_RELIGIOSO: 'Educador(a) Religioso(a)',
  LIDER: 'Líder',
  ADMIN: 'Administrador',

  // StatusResenha
  INGERIDA: 'Ingerida',
  CLASSIFICADA: 'Classificada',

  // StatusResenha e StatusDevocional
  REVISADA: 'Revisada',
  REVISADO: 'Revisado',
  GERADO: 'Gerado',

  // PapelDoutrina
  PRINCIPAL: 'Principal',
  SECUNDARIO: 'Secundário',
};

/** Um enum do Prisma vira lista de `{ valor, rotulo }`. */
function opcoes(enumerado: Record<string, string>) {
  return Object.values(enumerado).map((valor) => ({
    valor,
    rotulo: ROTULOS[valor] ?? valor,
  }));
}

/** O vocabulário montado, para a rota e para o conferidor de contrato. */
export async function vocabulario() {
  const doutrinas = await connection.doutrina.findMany({
    orderBy: { numero: 'asc' },
    select: { id: true, numero: true, nome: true, perguntaCentral: true },
  });

  return {
    turnos: opcoes(Turno),
    naturezas: opcoes(NaturezaEvento),
    origensDeData: opcoes(OrigemData),
    origensDePregador: opcoes(OrigemPregador),
    tiposDePregador: opcoes(TipoPregador),
    statusDeResenha: opcoes(StatusResenha),
    statusDeDevocional: opcoes(StatusDevocional),
    papeisDeDoutrina: opcoes(PapelDoutrina),
    papeisDeUsuario: opcoes(Papel),
    doutrinas,
  };
}

rotasMeta.get('/', async (_req, res, next) => {
  try {
    res.json(await vocabulario());
  } catch (e) {
    next(e);
  }
});
