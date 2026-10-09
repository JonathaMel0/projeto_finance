const MARCADOR_MOEDA = "\u0001";

export interface Token {
  /** Texto como digitado (sem pontuação final). */
  texto: string;
  /** Minúsculo e sem acentos, para comparações. */
  norm: string;
  /** Veio precedido de "R$". */
  explicitoMoeda: boolean;
  /** Já consumido por valor ou data. */
  usado: boolean;
}

export function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

export function tokenizar(texto: string): Token[] {
  const preparado = texto
    .replace(/R\$\s*(\d)/gi, `${MARCADOR_MOEDA}$1`)
    .replace(/R\$/gi, " ");

  const tokens: Token[] = [];
  for (const bruto of preparado.trim().split(/\s+/)) {
    const explicitoMoeda = bruto.startsWith(MARCADOR_MOEDA);
    const texto = bruto.replace(MARCADOR_MOEDA, "").replace(/[.,;:!?]+$/, "");
    if (!texto) continue;
    tokens.push({
      texto,
      norm: normalizar(texto),
      explicitoMoeda,
      usado: false,
    });
  }
  return tokens;
}

const CONECTORES = new Set(["de", "da", "do", "das", "dos", "e", "a", "o", "em"]);

/**
 * "conta de luz" -> "Conta de Luz". Restaura acentos de palavras conhecidas
 * (mapa norm -> forma acentuada) e preserva tokens que contêm dígitos.
 */
export function formatarDescricao(
  palavras: string[],
  acentos: Map<string, string>,
): string {
  return palavras
    .map((palavra, i) => {
      if (/\d/.test(palavra)) return palavra;
      const norm = normalizar(palavra);
      if (i > 0 && CONECTORES.has(norm)) return norm;
      const base = acentos.get(norm) ?? palavra.toLowerCase();
      return base.charAt(0).toUpperCase() + base.slice(1);
    })
    .join(" ");
}
