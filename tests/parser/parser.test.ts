import { describe, expect, it } from "vitest";
import {
  completarRascunho,
  parseMensagem,
  parseValorBR,
  type LancamentoParseado,
  type ResultadoParse,
} from "@/lib/parser";

const HOJE = "2026-09-30";

function parse(texto: string): ResultadoParse {
  return parseMensagem(texto, { hoje: HOJE });
}

function ok(texto: string): LancamentoParseado {
  const r = parse(texto);
  if (r.status !== "ok") {
    throw new Error(`"${texto}" retornou ${JSON.stringify(r)}`);
  }
  return r.lancamento;
}

describe("parseValorBR", () => {
  it.each([
    ["54", 54],
    ["54,90", 54.9],
    ["54.90", 54.9],
    ["1.500", 1500],
    ["1.500,50", 1500.5],
    ["1500.50", 1500.5],
    ["10900", 10900],
    ["10.900", 10900],
    ["12.345,67", 12345.67],
    ["0,50", 0.5],
  ])("interpreta %s como %d", (texto, esperado) => {
    expect(parseValorBR(texto)).toBe(esperado);
  });

  it.each(["1,500", "abc", "0", "12.34.56", "1.2.3", "", "10x"])(
    "rejeita %s",
    (texto) => {
      expect(parseValorBR(texto)).toBeNull();
    },
  );

  it("não confunde 1.500 com R$ 1,50", () => {
    expect(parseValorBR("1.500")).not.toBe(1.5);
  });
});

describe("mensagens válidas", () => {
  it("padaria 54,90", () => {
    expect(ok("padaria 54,90")).toEqual({
      tipo: "despesa",
      descricao: "Padaria",
      valor: 54.9,
      categoria: "Alimentação",
      data: undefined,
      formaPagamento: "não informado",
    });
  });

  it("mercado 150", () => {
    const l = ok("mercado 150");
    expect(l).toMatchObject({ valor: 150, categoria: "Alimentação" });
  });

  it("uber 27,50", () => {
    expect(ok("uber 27,50")).toMatchObject({
      valor: 27.5,
      categoria: "Transporte",
      tipo: "despesa",
    });
  });

  it("salario valid 10900", () => {
    expect(ok("salario valid 10900")).toEqual({
      tipo: "entrada",
      descricao: "Salário Valid",
      valor: 10900,
      categoria: "Salário",
      data: undefined,
    });
  });

  it("salário 10.900", () => {
    expect(ok("salário 10.900")).toMatchObject({
      tipo: "entrada",
      valor: 10900,
      descricao: "Salário",
    });
  });

  it("pix recebido joao 300 e pix recebido do joao 300", () => {
    for (const texto of ["pix recebido joao 300", "pix recebido do joao 300"]) {
      expect(ok(texto)).toMatchObject({
        tipo: "entrada",
        valor: 300,
        categoria: "Transferência",
      });
    }
  });

  it("almoço 35 ontem", () => {
    expect(ok("almoço 35 ontem")).toMatchObject({
      descricao: "Almoço",
      valor: 35,
      data: "2026-09-29",
      categoria: "Alimentação",
    });
  });

  it("freela 800", () => {
    expect(ok("freela 800")).toMatchObject({
      tipo: "entrada",
      categoria: "Freelance",
    });
  });

  it("conta de luz 180 (Moradia vence Contas)", () => {
    expect(ok("conta de luz 180")).toMatchObject({
      descricao: "Conta de Luz",
      categoria: "Moradia",
    });
  });

  it("farmacia 75", () => {
    expect(ok("farmacia 75")).toMatchObject({
      descricao: "Farmácia",
      categoria: "Saúde",
    });
  });

  it("compra mercado 50 (Alimentação vence Compras)", () => {
    expect(ok("compra mercado 50").categoria).toBe("Alimentação");
  });

  it("pagamento recebido 500 é entrada, não despesa", () => {
    expect(ok("pagamento recebido 500")).toMatchObject({
      tipo: "entrada",
      categoria: "Outros",
    });
  });

  it("aceita R$ colado ou separado", () => {
    expect(ok("cafe R$ 12,50").valor).toBe(12.5);
    expect(ok("mercado R$150").valor).toBe(150);
  });

  it("valor 99 não vira o app de transporte 99", () => {
    expect(ok("mercado 99")).toMatchObject({
      valor: 99,
      categoria: "Alimentação",
    });
  });

  it("desempata vários números pelo que tem centavos", () => {
    expect(ok("uber 99 27,50")).toMatchObject({ valor: 27.5 });
  });
});

describe("forma de pagamento", () => {
  it("padaria pix 54,90", () => {
    expect(ok("padaria pix 54,90")).toMatchObject({
      descricao: "Padaria",
      formaPagamento: "Pix",
    });
  });

  it.each([
    ["mercado 100 cartão de crédito", "Cartão de crédito"],
    ["mercado 100 debito", "Cartão de débito"],
    ["mercado 100 dinheiro", "Dinheiro"],
    ["aluguel 1500 boleto", "Boleto"],
    ["mercado 100 cartao", "Outros"],
  ])("%s -> %s", (texto, forma) => {
    expect(ok(texto).formaPagamento).toBe(forma);
  });

  it("entradas não têm forma de pagamento", () => {
    expect(ok("salario 10900").formaPagamento).toBeUndefined();
  });
});

describe("datas", () => {
  it.each([
    ["uber 15 hoje", "2026-09-30"],
    ["uber 15 ontem", "2026-09-29"],
    ["uber 15 anteontem", "2026-09-28"],
    ["uber 15 amanhã", "2026-10-01"],
    ["mercado 100 05/09", "2026-09-05"],
    ["mercado 100 05/09/2025", "2025-09-05"],
    ["aluguel 1500 dia 5", "2026-09-05"],
    ["salario 10900 dia 30", "2026-09-30"],
  ])("%s -> %s", (texto, data) => {
    expect(ok(texto).data).toBe(data);
  });

  it("dia X não é confundido com o valor", () => {
    expect(ok("aluguel 1500 dia 5").valor).toBe(1500);
  });

  it("sem data informada, não define data", () => {
    expect(ok("uber 15").data).toBeUndefined();
  });

  it("rejeita datas inexistentes", () => {
    for (const texto of [
      "mercado 100 31/02",
      "aluguel 1500 dia 31",
      "mercado 100 05/13",
    ]) {
      expect(parse(texto)).toEqual({ status: "invalido", motivo: "data_invalida" });
    }
  });

  it("rejeita mais de uma data", () => {
    expect(parse("mercado 100 hoje ontem")).toEqual({
      status: "invalido",
      motivo: "varias_datas",
    });
  });

  it("respeita virada de ano em 'amanhã'", () => {
    const r = parseMensagem("uber 15 amanhã", { hoje: "2026-12-31" });
    expect(r.status === "ok" && r.lancamento.data).toBe("2027-01-01");
  });
});

describe("mensagens inválidas (não criam lançamento)", () => {
  it.each([
    ["padaria", "sem_valor"],
    ["54,90", "sem_descricao"],
    ["oi", "sem_valor"],
    ["quanto gastei", "consulta"],
    ["quanto gastei com uber 2026", "consulta"],
    ["", "vazio"],
    ["   ", "vazio"],
    ["mercado 0", "sem_valor"],
    ["mercado 10 20", "varios_valores"],
    ["a".repeat(250) + " 10", "muito_longo"],
  ])("'%s' -> %s", (texto, motivo) => {
    expect(parse(texto)).toEqual({ status: "invalido", motivo });
  });
});

describe("tipo incerto", () => {
  it("pix joao 200 pergunta em vez de chutar", () => {
    const r = parse("pix joao 200");
    expect(r.status).toBe("tipo_incerto");
  });

  it("palavra sem classificação pergunta", () => {
    expect(parse("xyz 10").status).toBe("tipo_incerto");
  });

  it("termos de entrada e despesa juntos perguntam", () => {
    expect(parse("reembolso farmacia 40").status).toBe("tipo_incerto");
  });

  it("completarRascunho como entrada mantém 'Pix' na descrição", () => {
    const r = parse("pix joao 200");
    if (r.status !== "tipo_incerto") throw new Error("esperado tipo_incerto");
    expect(completarRascunho(r.rascunho, "entrada")).toEqual({
      tipo: "entrada",
      descricao: "Pix Joao",
      valor: 200,
      categoria: "Outros",
      data: undefined,
    });
  });

  it("completarRascunho como despesa usa Pix como forma de pagamento", () => {
    const r = parse("pix joao 200");
    if (r.status !== "tipo_incerto") throw new Error("esperado tipo_incerto");
    expect(completarRascunho(r.rascunho, "despesa")).toMatchObject({
      tipo: "despesa",
      descricao: "Joao",
      formaPagamento: "Pix",
      categoria: "Outros",
    });
  });

  it("completarRascunho usa a categoria do tipo escolhido", () => {
    const r = parse("reembolso farmacia 40");
    if (r.status !== "tipo_incerto") throw new Error("esperado tipo_incerto");
    expect(completarRascunho(r.rascunho, "entrada").categoria).toBe("Reembolso");
    expect(completarRascunho(r.rascunho, "despesa").categoria).toBe("Saúde");
  });
});
