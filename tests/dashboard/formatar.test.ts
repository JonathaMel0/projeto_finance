import { describe, expect, it } from "vitest";
import {
  formatarData,
  formatarMoeda,
  formatarPercentual,
} from "@/lib/dashboard/formatar";

const semEspacoEspecial = (s: string) => s.replace(/\u00a0/g, " ");

describe("formatação do dashboard", () => {
  it("formata moeda em reais", () => {
    expect(semEspacoEspecial(formatarMoeda(1500.9))).toBe("R$ 1.500,90");
    expect(semEspacoEspecial(formatarMoeda(0))).toBe("R$ 0,00");
    expect(semEspacoEspecial(formatarMoeda(-750))).toBe("-R$ 750,00");
  });

  it("formata percentual com vírgula", () => {
    expect(formatarPercentual(42.85)).toBe("42,9%");
    expect(formatarPercentual(0)).toBe("0,0%");
  });

  it("converte data ISO para dd/mm/aaaa e preserva o que não reconhece", () => {
    expect(formatarData("2026-10-09")).toBe("09/10/2026");
    expect(formatarData("lixo")).toBe("lixo");
  });
});
