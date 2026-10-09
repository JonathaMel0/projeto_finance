import { FORMA_NAO_INFORMADA } from "./types";
import type { Token } from "./texto";

const FORMAS: { forma: string; frases: string[][] }[] = [
  { forma: "Pix", frases: [["pix"]] },
  {
    forma: "Cartão de crédito",
    frases: [["cartao", "de", "credito"], ["cartao", "credito"], ["credito"]],
  },
  {
    forma: "Cartão de débito",
    frases: [["cartao", "de", "debito"], ["cartao", "debito"], ["debito"]],
  },
  { forma: "Dinheiro", frases: [["dinheiro"], ["especie"]] },
  { forma: "Transferência", frases: [["transferencia"], ["ted"]] },
  { forma: "Boleto", frases: [["boleto"]] },
  // "cartão" sozinho não diz se é crédito ou débito.
  { forma: "Outros", frases: [["cartao"]] },
];

export interface PagamentoDetectado {
  forma: string;
  /** Índices dos tokens que compõem a expressão de pagamento. */
  indices: number[];
}

/**
 * Procura a primeira forma de pagamento nos tokens livres. Sem indicação,
 * devolve "não informado" e nenhum índice.
 */
export function detectarPagamento(tokens: Token[]): PagamentoDetectado {
  let melhor: { forma: string; inicio: number; tamanho: number } | null = null;

  for (const { forma, frases } of FORMAS) {
    for (const frase of frases) {
      for (let inicio = 0; inicio + frase.length <= tokens.length; inicio++) {
        const casa = frase.every((palavra, k) => {
          const token = tokens[inicio + k];
          return token !== undefined && !token.usado && token.norm === palavra;
        });
        if (!casa) continue;
        const melhorQue =
          !melhor ||
          inicio < melhor.inicio ||
          (inicio === melhor.inicio && frase.length > melhor.tamanho);
        if (melhorQue) melhor = { forma, inicio, tamanho: frase.length };
      }
    }
  }

  if (!melhor) return { forma: FORMA_NAO_INFORMADA, indices: [] };
  return {
    forma: melhor.forma,
    indices: Array.from({ length: melhor.tamanho }, (_, k) => melhor.inicio + k),
  };
}
