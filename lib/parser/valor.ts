import type { Token } from "./texto";

/** "1.500", "1.500,50", "12.345,67": ponto separa milhar. */
const COM_MILHAR = /^[1-9]\d{0,2}(?:\.\d{3})+(?:,\d{1,2})?$/;
/** "54", "54,90", "54.90", "1500.50": ponto/vírgula separa centavos. */
const SIMPLES = /^\d+(?:[.,]\d{1,2})?$/;

/**
 * Converte um valor em formato brasileiro para número.
 * "1.500" é mil e quinhentos (e não 1,50); "1,500" não é aceito por ser
 * ambíguo. Retorna `null` quando o texto não é um valor positivo válido.
 */
export function parseValorBR(texto: string): number | null {
  let normalizado: string;
  if (COM_MILHAR.test(texto)) {
    normalizado = texto.replace(/\./g, "").replace(",", ".");
  } else if (SIMPLES.test(texto)) {
    normalizado = texto.replace(",", ".");
  } else {
    return null;
  }
  const valor = Math.round(Number(normalizado) * 100) / 100;
  return Number.isFinite(valor) && valor > 0 ? valor : null;
}

/** Tem centavos explícitos (",90" ou ".90"), o que o torna mais confiável. */
function temCentavos(texto: string): boolean {
  return /[.,]\d{1,2}$/.test(texto) && !/^[1-9]\d{0,2}(?:\.\d{3})+$/.test(texto);
}

export type ResultadoValor =
  | { ok: true; valor: number }
  | { ok: false; motivo: "sem_valor" | "varios_valores" };

/**
 * Localiza o valor entre os tokens livres e o marca como usado. Com mais de
 * um candidato, só decide se exatamente um tiver "R$" ou centavos explícitos
 * (ex.: "uber 99 27,50"); caso contrário não adivinha.
 */
export function extrairValor(tokens: Token[]): ResultadoValor {
  const candidatos = tokens
    .map((token) => ({ token, valor: parseValorBR(token.texto) }))
    .filter(
      (c): c is { token: Token; valor: number } =>
        !c.token.usado && c.valor !== null,
    );

  if (candidatos.length === 0) return { ok: false, motivo: "sem_valor" };

  let escolhido = candidatos.length === 1 ? candidatos[0] : undefined;
  if (!escolhido) {
    const explicitos = candidatos.filter(
      (c) => c.token.explicitoMoeda || temCentavos(c.token.texto),
    );
    if (explicitos.length === 1) escolhido = explicitos[0];
  }
  if (!escolhido) return { ok: false, motivo: "varios_valores" };

  escolhido.token.usado = true;
  return { ok: true, valor: escolhido.valor };
}
