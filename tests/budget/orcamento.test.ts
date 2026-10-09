import { describe, expect, it } from "vitest";
import { calcularOrcamento } from "@/lib/budget/calculo";
import {
  carregarConfigOrcamento,
  CONFIG_ORCAMENTO_PADRAO,
  grupoDaCategoria,
  lerConfigOrcamento,
} from "@/lib/budget/config";
import type { SheetsDataSource } from "@/lib/google-sheets/client";
import type { ResumoMensal } from "@/types/finance";

function resumo(
  entradas: number,
  despesasPorCategoria: Record<string, number>,
  ano = 2026,
  mes = 10,
): ResumoMensal {
  const totalDespesas = Object.values(despesasPorCategoria).reduce((a, b) => a + b, 0);
  return {
    ano,
    mes,
    totalEntradas: entradas,
    totalDespesas,
    saldo: entradas - totalDespesas,
    quantidadeDespesas: 0,
    quantidadeEntradas: 1,
    despesasPorCategoria,
    entradasPorCategoria: {},
  };
}

describe("lerConfigOrcamento", () => {
  it("lê o saldo inicial em formatos comuns", () => {
    expect(lerConfigOrcamento([]).saldoInicial).toBe(0);
    expect(lerConfigOrcamento([["saldo_inicial", "1500.5"]]).saldoInicial).toBe(1500.5);
    expect(lerConfigOrcamento([["saldo_inicial", "R$ 1.234,56"]]).saldoInicial).toBe(1234.56);
    expect(lerConfigOrcamento([["saldo_inicial", "-200"]]).saldoInicial).toBe(-200);
  });

  it("avisa se o saldo inicial for inválido", () => {
    const { saldoInicial, avisos } = lerConfigOrcamento([["saldo_inicial", "muito"]]);
    expect(saldoInicial).toBe(0);
    expect(avisos[0]).toContain("saldo_inicial");
  });

  it("usa o padrão 50/30/20 sem configuração", () => {
    const { config, avisos } = lerConfigOrcamento([]);
    expect(config.percentuais).toEqual({ necessidade: 50, desejo: 30, objetivo: 20 });
    expect(avisos).toEqual([]);
  });

  it("lê percentuais personalizados, com vírgula e %", () => {
    const { config, avisos } = lerConfigOrcamento([
      ["orcamento_necessidades", "60%"],
      ["orcamento_desejos", "20"],
      ["orcamento_objetivos", "20,0"],
    ]);
    expect(config.percentuais).toEqual({ necessidade: 60, desejo: 20, objetivo: 20 });
    expect(avisos).toEqual([]);
  });

  it("aceita células em formato de porcentagem (frações)", () => {
    const { config } = lerConfigOrcamento([
      ["orcamento_necessidades", "0.6"],
      ["orcamento_desejos", "0.2"],
      ["orcamento_objetivos", "0.2"],
    ]);
    expect(config.percentuais.necessidade).toBeCloseTo(60);
  });

  it("volta ao padrão com aviso se não somar 100", () => {
    const { config, avisos } = lerConfigOrcamento([
      ["orcamento_necessidades", "70"],
      ["orcamento_desejos", "20"],
      ["orcamento_objetivos", "20"],
    ]);
    expect(config.percentuais).toEqual(CONFIG_ORCAMENTO_PADRAO.percentuais);
    expect(avisos[0]).toContain("somam 110");
  });

  it("avisa sobre valores inválidos", () => {
    const { avisos } = lerConfigOrcamento([
      ["orcamento_desejos", "abc"],
      ["classificacao_lazer", "talvez"],
    ]);
    expect(avisos).toHaveLength(2);
  });

  it("permite reclassificar categorias, ignorando acento e caixa", () => {
    const { config } = lerConfigOrcamento([
      ["classificacao_Lazer", "Necessidade"],
      ["classificacao_Café", "desejo"],
    ]);
    expect(grupoDaCategoria("LAZER", config)).toBe("necessidade");
    expect(grupoDaCategoria("Saúde", config)).toBe("necessidade");
    expect(grupoDaCategoria("Cafe", config)).toBe("desejo");
    expect(grupoDaCategoria("Categoria nova", config)).toBe("desejo");
  });
});

describe("carregarConfigOrcamento", () => {
  it("cai no padrão com aviso se a leitura falhar", async () => {
    const quebrado = {
      readRows: async () => {
        throw new Error("falhou");
      },
    } as unknown as SheetsDataSource;
    const errorSpy = console.error;
    console.error = () => {};
    const { config, avisos } = await carregarConfigOrcamento(quebrado);
    console.error = errorSpy;
    expect(config).toEqual(CONFIG_ORCAMENTO_PADRAO);
    expect(avisos).toHaveLength(1);
  });
});

describe("calcularOrcamento", () => {
  const config = CONFIG_ORCAMENTO_PADRAO;

  it("é nulo sem entradas", () => {
    expect(calcularOrcamento(resumo(0, { Moradia: 100 }), config, { ano: 2026, mes: 10, dia: 5 })).toBeNull();
  });

  it("separa planejado e realizado por grupo", () => {
    const o = calcularOrcamento(
      resumo(10000, { Moradia: 3000, Alimentação: 1000, Lazer: 500, Investimentos: 800 }),
      config,
      { ano: 2026, mes: 10, dia: 5 },
    )!;
    const [nec, des, obj] = o.grupos;
    expect(nec).toMatchObject({ planejado: 5000, realizado: 4000, restante: 1000, excesso: 0 });
    expect(des).toMatchObject({ planejado: 3000, realizado: 500, restante: 2500 });
    expect(obj).toMatchObject({ planejado: 2000, realizado: 800, restante: 1200, excesso: 0 });
    expect(o.podeGastar).toBe(8000 - 4500);
  });

  it("calcula o limite diário no mês atual contando hoje", () => {
    // outubro tem 31 dias; dia 22 => 10 dias restantes
    const o = calcularOrcamento(resumo(10000, { Moradia: 3000 }), config, {
      ano: 2026,
      mes: 10,
      dia: 22,
    })!;
    expect(o.diasRestantes).toBe(10);
    expect(o.limiteDiario).toBeCloseTo((8000 - 3000) / 10);
  });

  it("não calcula limite diário para outro mês", () => {
    const o = calcularOrcamento(resumo(10000, { Moradia: 3000 }, 2026, 9), config, {
      ano: 2026,
      mes: 10,
      dia: 5,
    })!;
    expect(o.diasRestantes).toBeNull();
    expect(o.limiteDiario).toBeNull();
  });

  it("indica excesso e orçamento esgotado", () => {
    const o = calcularOrcamento(resumo(10000, { Moradia: 5750, Lazer: 3500 }), config, {
      ano: 2026,
      mes: 10,
      dia: 5,
    })!;
    expect(o.grupos[0]?.excesso).toBe(750);
    expect(o.grupos[1]?.excesso).toBe(500);
    expect(o.podeGastar).toBe(-1250);
    expect(o.limiteDiario).toBeNull();
    expect(o.sugestoes.join(" ")).toContain("acima do limite planejado para necessidades");
    expect(o.sugestoes.join(" ")).toContain("já foi atingido");
  });
});
