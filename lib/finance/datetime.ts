export const TIME_ZONE = "America/Sao_Paulo";

/** Retorna a data no fuso de São Paulo, no formato "YYYY-MM-DD". */
export function formatDateSaoPaulo(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/** Retorna o horário no fuso de São Paulo, no formato "HH:mm". */
export function formatTimeSaoPaulo(date: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

/** Ano e mês atuais, considerando o fuso de São Paulo. */
export function getAnoMesAtual(referencia: Date = new Date()): {
  ano: number;
  mes: number;
} {
  const [ano = 0, mes = 0] = formatDateSaoPaulo(referencia)
    .split("-")
    .map(Number);
  return { ano, mes };
}

/** Prefixo "YYYY-MM" usado para filtrar lançamentos de um mês específico. */
export function prefixoAnoMes(ano: number, mes: number): string {
  return `${String(ano).padStart(4, "0")}-${String(mes).padStart(2, "0")}`;
}
