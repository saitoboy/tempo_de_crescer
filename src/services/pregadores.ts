/**
 * Resolve a assinatura crua de uma resenha para um pregador do cadastro.
 *
 * O acervo traz 72 grafias distintas para cerca de 40 pessoas: "Nélio",
 * "NÉLIO MONTEIRO" e "Nelio" são a mesma; "Fernando Arede" e "Fernando Arêde"
 * também. A comparação ignora acento e caixa por isso.
 */

export type PregadorConhecido = {
  id: string;
  nomeCanonico: string;
  aliases: string[];
};

export function chave(nome: string): string {
  return nome
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Devolve o pregador do cadastro que corresponde à assinatura, ou null quando
 * nenhum corresponde — nesse caso quem chama decide se cadastra um visitante.
 *
 * Não faz correspondência por primeiro nome solto: "Gabriel" só vira Gabriel
 * Monteiro porque esse apelido está no cadastro dele. Adivinhar por primeiro
 * nome atribuiria pregação à pessoa errada.
 */
export function resolverPregador(
  bruto: string,
  conhecidos: PregadorConhecido[],
): PregadorConhecido | null {
  const alvo = chave(bruto);
  if (!alvo) return null;

  return (
    conhecidos.find((p) => chave(p.nomeCanonico) === alvo) ??
    conhecidos.find((p) => p.aliases.some((a) => chave(a) === alvo)) ??
    null
  );
}
