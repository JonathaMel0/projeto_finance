import { describe, expect, it } from "vitest";
import {
  lerFiltros,
  montarDashboard,
  montarDiario,
  montarEvolucao,
  saldoAte,
} from "@/lib/dashboard/dados";
import type { Lancamento } from "@/types/finance";

const base = {
  hora: "12:00",
  observacao: undefined,
  origem: "telegram",
  createdAt: "",
  updatedAt: "",
};

let seq = 0;
function despesa(data: string, valor: number, categoria: string, forma = "pix"): Lancamento {
  return { ...base, id: `d${seq++}`, tipo: "despesa", data, valor, categoria, descricao: categoria, formaPagamento: forma };
}
function entrada(data: string, valor: number): Lancamento {
  return { ...base, id: `e${seq++}`, tipo: "entrada", data, valor, categoria: "salário", descricao: "salário" };
}

const dados: Lancamento[] = [
  entrada("2026-10-05", 1000),
  despesa("2026-10-01", 100, "alimentação"),
  despesa("2026-10-01", 50, "transporte", "crédito"),
  despesa("2026-10-03", 50, "alimentação"),
  despesa("2026-09-10", 200, "lazer"),
  despesa("2025-12-20", 30, "lazer"),
];

describe("lerFiltros", () => {
  const atual = { ano: 2026, mes: 10 };

  it("usa o mês atual quando ausente ou inválido", () => {
    expect(lerFiltros({}, atual)).toMatchObject({ ano: 2026, mes: 10 });
    expect(lerFiltros({ mes: "13", ano: "abc" }, atual)).toMatchObject({ ano: 2026, mes: 10 });
  });

  it("lê os filtros válidos e ignora tipo desconhecido", () => {
    expect(
      lerFiltros({ mes: "3", ano: "2025", tipo: "despesa", categoria: "lazer", pagamento: "pix" }, atual),
    ).toEqual({ mes: 3, ano: 2025, tipo: "despesa", categoria: "lazer", formaPagamento: "pix" });
    expect(lerFiltros({ tipo: "x" }, atual).tipo).toBeUndefined();
  });
});

describe("montarDashboard", () => {
  it("resume apenas o mês selecionado", () => {
    const r = montarDashboard(dados, { ano: 2026, mes: 10 });
    expect(r.resumo.totalEntradas).toBe(1000);
    expect(r.resumo.totalDespesas).toBe(200);
    expect(r.resumo.saldo).toBe(800);
    expect(r.taxaPoupanca).toBe(80);
    expect(r.categorias[0]).toMatchObject({ categoria: "alimentação", valor: 150, percentual: 75 });
  });

  it("taxa de poupança é nula sem entradas", () => {
    expect(montarDashboard(dados, { ano: 2026, mes: 9 }).taxaPoupanca).toBeNull();
  });

  it("filtros afetam só a tabela, ordenada da mais recente para a mais antiga", () => {
    const r = montarDashboard(dados, { ano: 2026, mes: 10, categoria: "alimentação" });
    expect(r.lancamentos.map((l) => l.data)).toEqual(["2026-10-03", "2026-10-01"]);
    expect(r.resumo.totalDespesas).toBe(200);

    const pagto = montarDashboard(dados, { ano: 2026, mes: 10, formaPagamento: "crédito" });
    expect(pagto.lancamentos).toHaveLength(1);

    const tipo = montarDashboard(dados, { ano: 2026, mes: 10, tipo: "entrada" });
    expect(tipo.lancamentos).toHaveLength(1);
  });

  it("lista as opções disponíveis", () => {
    const r = montarDashboard(dados, { ano: 2026, mes: 10 });
    expect(r.opcoes.anos).toEqual([2026, 2025]);
    expect(r.opcoes.formasPagamento).toEqual(["crédito", "pix"]);
  });
});

describe("saldo em conta (acumulado)", () => {
  // entradas 1000; despesas: out 200, set 200, dez/2025 30
  it("soma todos os meses até o fim do mês selecionado", () => {
    expect(saldoAte(dados, 0, "2026-10-31")).toBe(1000 - 200 - 200 - 30);
    expect(saldoAte(dados, 0, "2026-09-30")).toBe(-230);
    expect(saldoAte(dados, 0, "2025-12-31")).toBe(-30);
  });

  it("inclui o saldo inicial", () => {
    expect(saldoAte(dados, 500, "2026-10-31")).toBe(1070);
  });

  it("não depende do mês exibido nem dos filtros da tabela", () => {
    const out = montarDashboard(dados, { ano: 2026, mes: 10, categoria: "lazer" });
    const set = montarDashboard(dados, { ano: 2026, mes: 9 });
    expect(out.saldoEmConta).toBe(570);
    expect(set.saldoEmConta).toBe(-230);
    expect(out.resumo.saldo).toBe(800);
  });

  it("ignora lançamentos futuros (ainda não estão na conta)", () => {
    const r = montarDashboard(dados, { ano: 2026, mes: 10 }, { hoje: "2026-10-04" });
    // a entrada de 05/10 ainda não aconteceu
    expect(r.saldoEmConta).toBe(-100 - 50 - 50 - 200 - 30);
  });

  it("a base do orçamento é o saldo em conta somado aos gastos já pagos no mês", () => {
    const r = montarDashboard(dados, { ano: 2026, mes: 10 }, { saldoInicial: 500 });
    // saldo 1070 + despesas de outubro (200): não encolhe ao gastar
    expect(r.baseOrcamento).toBe(1270);

    // lançamentos futuros não entram no saldo nem na base
    const antes = montarDashboard(dados, { ano: 2026, mes: 10 }, { hoje: "2026-10-04" });
    expect(antes.baseOrcamento).toBe(antes.saldoEmConta + 200);
  });

  it("a evolução traz o saldo acumulado ao fim de cada mês", () => {
    const e = montarEvolucao(dados, 2026, 10, 3, 100);
    expect(e.map((p) => p.saldoAcumulado)).toEqual([
      100 - 30 - 0, // agosto: só dez/2025
      100 - 30 - 200, // setembro
      100 - 30 - 200 + 1000 - 200, // outubro
    ]);
    expect(e[2]?.saldo).toBe(800);
  });
});

describe("montarEvolucao", () => {
  it("retorna os 6 meses terminando no selecionado, atravessando o ano", () => {
    const e = montarEvolucao(dados, 2026, 2);
    expect(e.map((p) => `${p.ano}-${p.mes}`)).toEqual([
      "2025-9", "2025-10", "2025-11", "2025-12", "2026-1", "2026-2",
    ]);
    expect(e[3]?.despesas).toBe(30);
  });
});

describe("montarDiario", () => {
  it("acumula despesas por dia e ignora entradas", () => {
    const d = montarDiario(dados.filter((l) => l.data.startsWith("2026-10")), 2026, 10);
    expect(d).toHaveLength(31);
    expect(d[0]).toEqual({ dia: 1, valor: 150, acumulado: 150 });
    expect(d[2]).toEqual({ dia: 3, valor: 50, acumulado: 200 });
    expect(d[30]?.acumulado).toBe(200);
  });
});
