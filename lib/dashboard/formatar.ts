const BRL = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

export function formatarMoeda(valor: number): string {
  return BRL.format(valor);
}

export function formatarPercentual(valor: number): string {
  return `${valor.toFixed(1).replace(".", ",")}%`;
}

/** "2026-10-09" -> "09/10/2026" */
export function formatarData(iso: string): string {
  const [a, m, d] = iso.split("-");
  return a && m && d ? `${d}/${m}/${a}` : iso;
}
