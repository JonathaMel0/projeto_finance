const formatadorBRL = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

/** 1500.5 -> "R$ 1.500,50" */
export function formatarMoeda(valor: number): string {
  return formatadorBRL.format(valor).replace(/ /g, " ");
}

/** "2026-09-30" -> "30/09/2026" */
export function formatarData(iso: string): string {
  const [ano, mes, dia] = iso.split("-");
  return `${dia}/${mes}/${ano}`;
}
