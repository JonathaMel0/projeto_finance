import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GoogleSheetsFinanceRepository } from "@/lib/finance/google-sheets-repository";
import { LancamentoNaoEncontradoError } from "@/lib/finance/repository";
import { FakeSheetsClient } from "../helpers/fake-sheets-client";

describe("GoogleSheetsFinanceRepository", () => {
  let sheets: FakeSheetsClient;
  let repository: GoogleSheetsFinanceRepository;

  beforeEach(() => {
    sheets = new FakeSheetsClient();
    repository = new GoogleSheetsFinanceRepository(sheets);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("cria uma despesa e persiste a linha na aba 'despesas'", async () => {
    const despesa = await repository.criarDespesa({
      descricao: "Supermercado",
      valor: 150.5,
      categoria: "mercado",
      formaPagamento: "cartao",
      origem: "telegram",
    });

    expect(despesa.id).toBeTruthy();
    expect(despesa.tipo).toBe("despesa");
    expect(sheets.dump("despesas")).toHaveLength(1);
    expect(sheets.dump("despesas")[0]?.[0]).toBe(despesa.id);
  });

  it("usa o id informado pelo chamador (idempotência)", async () => {
    const despesa = await repository.criarDespesa({
      id: "meu-id",
      descricao: "Padaria",
      valor: 10,
      categoria: "Alimentação",
      formaPagamento: "Pix",
      origem: "telegram",
    });
    const entrada = await repository.criarEntrada({
      id: "outro-id",
      descricao: "Freela",
      valor: 10,
      categoria: "Freelance",
      origem: "telegram",
    });

    expect(despesa.id).toBe("meu-id");
    expect(entrada.id).toBe("outro-id");
    expect((await repository.buscarLancamentoPorId("meu-id"))?.tipo).toBe("despesa");
  });

  it("cria uma entrada e persiste a linha na aba 'entradas'", async () => {
    const entrada = await repository.criarEntrada({
      descricao: "Salário",
      valor: 5000,
      categoria: "salario",
      origem: "telegram",
    });

    expect(entrada.tipo).toBe("entrada");
    expect(sheets.dump("entradas")).toHaveLength(1);
  });

  it("busca um lançamento por id (despesa ou entrada)", async () => {
    const despesa = await repository.criarDespesa({
      descricao: "Uber",
      valor: 32,
      categoria: "transporte",
      formaPagamento: "pix",
      origem: "telegram",
    });
    const entrada = await repository.criarEntrada({
      descricao: "Freela",
      valor: 800,
      categoria: "extra",
      origem: "telegram",
    });

    await expect(repository.buscarLancamentoPorId(despesa.id)).resolves.toEqual(
      despesa,
    );
    await expect(repository.buscarLancamentoPorId(entrada.id)).resolves.toEqual(
      entrada,
    );
    await expect(repository.buscarLancamentoPorId("inexistente")).resolves.toBeNull();
  });

  it("lista lançamentos combinando despesas e entradas, ordenados por data/hora", async () => {
    await repository.criarDespesa({
      data: "2026-01-10",
      hora: "09:00",
      descricao: "Mercado",
      valor: 100,
      categoria: "mercado",
      formaPagamento: "cartao",
      origem: "telegram",
    });
    await repository.criarEntrada({
      data: "2026-01-05",
      hora: "08:00",
      descricao: "Salário",
      valor: 5000,
      categoria: "salario",
      origem: "telegram",
    });

    const lancamentos = await repository.listarLancamentos();

    expect(lancamentos).toHaveLength(2);
    expect(lancamentos[0]?.descricao).toBe("Salário");
    expect(lancamentos[1]?.descricao).toBe("Mercado");
  });

  it("filtra lançamentos por tipo e categoria", async () => {
    await repository.criarDespesa({
      descricao: "Mercado",
      valor: 100,
      categoria: "mercado",
      formaPagamento: "cartao",
      origem: "telegram",
    });
    await repository.criarEntrada({
      descricao: "Salário",
      valor: 5000,
      categoria: "salario",
      origem: "telegram",
    });

    const apenasDespesas = await repository.listarLancamentos({ tipo: "despesa" });
    expect(apenasDespesas).toHaveLength(1);
    expect(apenasDespesas[0]?.tipo).toBe("despesa");

    const porCategoria = await repository.listarLancamentos({
      categoria: "salario",
    });
    expect(porCategoria).toHaveLength(1);
    expect(porCategoria[0]?.descricao).toBe("Salário");
  });

  it("atualiza um lançamento existente e marca updatedAt", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-09-30T12:00:00.000Z"));
    const despesa = await repository.criarDespesa({
      descricao: "Mercado",
      valor: 100,
      categoria: "mercado",
      formaPagamento: "cartao",
      origem: "telegram",
    });

    vi.setSystemTime(new Date("2026-09-30T12:00:05.000Z"));
    const atualizada = await repository.atualizarLancamento(despesa.id, {
      valor: 120,
      descricao: "Mercado (ajustado)",
    });

    expect(atualizada.valor).toBe(120);
    expect(atualizada.descricao).toBe("Mercado (ajustado)");
    expect(atualizada.id).toBe(despesa.id);
    expect(atualizada.updatedAt).not.toBe(despesa.updatedAt);

    const relido = await repository.buscarLancamentoPorId(despesa.id);
    expect(relido).toEqual(atualizada);
  });

  it("lança erro ao atualizar lançamento inexistente", async () => {
    await expect(
      repository.atualizarLancamento("inexistente", { valor: 10 }),
    ).rejects.toBeInstanceOf(LancamentoNaoEncontradoError);
  });

  it("exclui um lançamento existente", async () => {
    const despesa = await repository.criarDespesa({
      descricao: "Mercado",
      valor: 100,
      categoria: "mercado",
      formaPagamento: "cartao",
      origem: "telegram",
    });
    const entrada = await repository.criarEntrada({
      descricao: "Salário",
      valor: 5000,
      categoria: "salario",
      origem: "telegram",
    });

    await repository.excluirLancamento(despesa.id);

    expect(sheets.dump("despesas")).toHaveLength(0);
    await expect(repository.buscarLancamentoPorId(despesa.id)).resolves.toBeNull();
    await expect(repository.buscarLancamentoPorId(entrada.id)).resolves.not.toBeNull();
  });

  it("lança erro ao excluir lançamento inexistente", async () => {
    await expect(
      repository.excluirLancamento("inexistente"),
    ).rejects.toBeInstanceOf(LancamentoNaoEncontradoError);
  });

  it("lista lançamentos de um mês específico", async () => {
    await repository.criarDespesa({
      data: "2026-01-15",
      descricao: "Janeiro",
      valor: 50,
      categoria: "mercado",
      formaPagamento: "pix",
      origem: "telegram",
    });
    await repository.criarDespesa({
      data: "2026-02-01",
      descricao: "Fevereiro",
      valor: 70,
      categoria: "mercado",
      formaPagamento: "pix",
      origem: "telegram",
    });

    const doMes = await repository.listarLancamentosDoMes(2026, 1);

    expect(doMes).toHaveLength(1);
    expect(doMes[0]?.descricao).toBe("Janeiro");
  });

  it("calcula o resumo mensal com totais, saldo e agrupamento por categoria", async () => {
    await repository.criarDespesa({
      data: "2026-01-05",
      descricao: "Mercado",
      valor: 100,
      categoria: "mercado",
      formaPagamento: "pix",
      origem: "telegram",
    });
    await repository.criarDespesa({
      data: "2026-01-06",
      descricao: "Farmácia",
      valor: 40,
      categoria: "saude",
      formaPagamento: "pix",
      origem: "telegram",
    });
    await repository.criarEntrada({
      data: "2026-01-01",
      descricao: "Salário",
      valor: 5000,
      categoria: "salario",
      origem: "telegram",
    });

    const resumo = await repository.calcularResumoMensal(2026, 1);

    expect(resumo.totalDespesas).toBe(140);
    expect(resumo.totalEntradas).toBe(5000);
    expect(resumo.saldo).toBe(4860);
    expect(resumo.quantidadeDespesas).toBe(2);
    expect(resumo.quantidadeEntradas).toBe(1);
    expect(resumo.despesasPorCategoria).toEqual({ mercado: 100, saude: 40 });
    expect(resumo.entradasPorCategoria).toEqual({ salario: 5000 });
  });
});
