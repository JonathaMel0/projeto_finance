import { describe, expect, it } from "vitest";
import {
  formatDateSaoPaulo,
  formatTimeSaoPaulo,
  getAnoMesAtual,
  prefixoAnoMes,
} from "@/lib/finance/datetime";

describe("datetime (America/Sao_Paulo)", () => {
  it("formata a data em UTC convertendo para o horário de São Paulo", () => {
    // 2026-01-01T02:30:00Z = 2025-12-31T23:30:00 em São Paulo (UTC-3)
    const data = new Date("2026-01-01T02:30:00Z");

    expect(formatDateSaoPaulo(data)).toBe("2025-12-31");
    expect(formatTimeSaoPaulo(data)).toBe("23:30");
  });

  it("calcula ano/mês atuais a partir de uma data de referência", () => {
    const referencia = new Date("2026-03-01T01:00:00Z"); // 2026-02-28 22:00 em SP
    expect(getAnoMesAtual(referencia)).toEqual({ ano: 2026, mes: 2 });
  });

  it("monta o prefixo YYYY-MM com zero à esquerda", () => {
    expect(prefixoAnoMes(2026, 1)).toBe("2026-01");
    expect(prefixoAnoMes(2026, 12)).toBe("2026-12");
  });
});
