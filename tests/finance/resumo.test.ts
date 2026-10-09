import { describe, expect, it } from "vitest";
import { calcularResumoMensal } from "@/lib/finance/resumo";
import type { Lancamento } from "@/types/finance";

const base = {
  data: "2026-10-01",
  hora: "10:00",
  origem: "telegram",
  createdAt: "",
  updatedAt: "",
};

const lancamentos: Lancamento[] = [
  { ...base, id: "1", tipo: "despesa", descricao: "a", valor: 100, categoria: "Lazer", formaPagamento: "pix" },
  { ...base, id: "2", tipo: "despesa", descricao: "b", valor: 50.5, categoria: "Lazer", formaPagamento: "pix" },
  { ...base, id: "3", tipo: "despesa", descricao: "c", valor: 20, categoria: "Moradia", formaPagamento: "boleto" },
  { ...base, id: "4", tipo: "entrada", descricao: "d", valor: 1000, categoria: "Salário" },
];

describe("calcularResumoMensal", () => {
  it("totaliza, calcula saldo e agrupa por categoria", () => {
    expect(calcularResumoMensal(lancamentos, 2026, 10)).toEqual({
      ano: 2026,
      mes: 10,
      totalDespesas: 170.5,
      totalEntradas: 1000,
      saldo: 829.5,
      quantidadeDespesas: 3,
      quantidadeEntradas: 1,
      despesasPorCategoria: { Lazer: 150.5, Moradia: 20 },
      entradasPorCategoria: { Salário: 1000 },
    });
  });

  it("devolve zeros sem lançamentos", () => {
    expect(calcularResumoMensal([], 2026, 1)).toMatchObject({
      totalDespesas: 0,
      totalEntradas: 0,
      saldo: 0,
      despesasPorCategoria: {},
    });
  });
});
