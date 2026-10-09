import { beforeEach, describe, expect, it, vi } from "vitest";
import { SheetsAuditLog } from "@/lib/finance/audit-log";
import { GoogleSheetsFinanceRepository } from "@/lib/finance/google-sheets-repository";
import { interpretarCampo, reconhecerCampo } from "@/lib/parser";
import { criarBot } from "@/lib/telegram/bot";
import { SheetsPendingStore } from "@/lib/telegram/pending-store";
import type {
  TelegramCallbackQuery,
  TelegramMessage,
} from "@/lib/telegram/types";
import { FakeSheetsClient } from "../helpers/fake-sheets-client";

const CHAT = 99;
const USER = 123456789;
const AGORA = new Date("2026-09-30T15:00:00.000Z");

function setup(agora: () => Date = () => AGORA) {
  const sheets = new FakeSheetsClient();
  const client = {
    sendMessage: vi.fn().mockResolvedValue(undefined),
    answerCallbackQuery: vi.fn().mockResolvedValue(undefined),
    editMessageText: vi.fn().mockResolvedValue(undefined),
  };
  let n = 0;
  const repo = new GoogleSheetsFinanceRepository(sheets);
  const bot = criarBot({
    client,
    repo,
    store: new SheetsPendingStore(sheets),
    audit: new SheetsAuditLog(sheets, () => AGORA),
    agora,
    novoId: () => `id-${++n}`,
  });
  return { sheets, client, repo, bot };
}

type Ctx = ReturnType<typeof setup>;

function mensagem(text: string): TelegramMessage {
  return {
    message_id: 7,
    from: { id: USER },
    chat: { id: CHAT, type: "private" },
    date: 0,
    text,
  };
}

function clique(data: string): TelegramCallbackQuery {
  return {
    id: "cb",
    from: { id: USER },
    message: { message_id: 8, chat: { id: CHAT, type: "private" }, date: 0 },
    data,
  };
}

/** Cria lançamentos já gravados: "a" (despesa) e depois "b" (entrada). */
async function semear(ctx: Ctx) {
  await ctx.repo.criarDespesa({
    id: "a",
    descricao: "Padaria",
    valor: 54.9,
    categoria: "Alimentação",
    formaPagamento: "não informado",
    origem: "telegram",
    data: "2026-09-29",
  });
  await new Promise((r) => setTimeout(r, 5));
  await ctx.repo.criarEntrada({
    id: "b",
    descricao: "Salário Valid",
    valor: 10900,
    categoria: "Salário",
    origem: "telegram",
    data: "2026-09-30",
  });
}

function ultimaResposta(ctx: Ctx): string {
  const chamadas = ctx.client.sendMessage.mock.calls;
  return chamadas[chamadas.length - 1]?.[1] ?? "";
}

function ultimaEdicao(ctx: Ctx): string {
  const chamadas = ctx.client.editMessageText.mock.calls;
  return chamadas[chamadas.length - 1]?.[2] ?? "";
}

function logs(ctx: Ctx): string[][] {
  return ctx.sheets.dump("logs");
}

function callbacks(teclado: { callback_data: string }[][] | undefined) {
  return (teclado ?? []).flat().map((b) => b.callback_data);
}

describe("interpretarCampo", () => {
  const base = { tipo: "despesa" as const, hoje: "2026-09-30" };

  it("reconhece campos e sinônimos", () => {
    expect(reconhecerCampo("Descrição")).toBe("descricao");
    expect(reconhecerCampo("cat")).toBe("categoria");
    expect(reconhecerCampo("preco")).toBeNull();
  });

  it("valida valor, categoria, data e descrição", () => {
    expect(interpretarCampo("valor", "R$ 1.500,50", base)).toEqual({
      ok: true,
      valor: 1500.5,
    });
    expect(interpretarCampo("valor", "abc", base).ok).toBe(false);
    expect(interpretarCampo("categoria", "LAZER", base)).toEqual({
      ok: true,
      valor: "Lazer",
    });
    expect(interpretarCampo("categoria", "salario", base).ok).toBe(false);
    expect(interpretarCampo("data", "ontem", base)).toEqual({
      ok: true,
      valor: "2026-09-29",
    });
    expect(interpretarCampo("data", "05/09", base)).toEqual({
      ok: true,
      valor: "2026-09-05",
    });
    expect(interpretarCampo("data", "ontem blablabla", base).ok).toBe(false);
    expect(interpretarCampo("data", "31/02", base).ok).toBe(false);
    expect(interpretarCampo("descricao", "padaria do bairro", base)).toEqual({
      ok: true,
      valor: "Padaria do Bairro",
    });
    expect(interpretarCampo("descricao", "  ", base).ok).toBe(false);
  });
});

describe("/ultimos", () => {
  let ctx: Ctx;
  beforeEach(async () => {
    ctx = setup();
    await semear(ctx);
  });

  it("lista do mais recente para o mais antigo", async () => {
    await ctx.bot.onCommand("ultimos", "", mensagem("/ultimos"));
    const texto = ultimaResposta(ctx);
    expect(texto.indexOf("Salário Valid")).toBeLessThan(
      texto.indexOf("Padaria"),
    );
    expect(texto).toContain(
      "1. Entrada · Salário Valid · R$ 10.900,00 · 30/09/2026",
    );
  });

  it("avisa quando não há lançamentos", async () => {
    const vazio = setup();
    await vazio.bot.onCommand("ultimos", "", mensagem("/ultimos"));
    expect(ultimaResposta(vazio)).toContain("Ainda não há lançamentos");
  });

  it("aceita o comando sem barra e com acento", async () => {
    await ctx.bot.onText(mensagem("últimos"));
    expect(ultimaResposta(ctx)).toContain("Últimos lançamentos:");
  });

  it("outros comandos não são tratados", async () => {
    expect(await ctx.bot.onCommand("saldo", "", mensagem("/saldo"))).toBe(
      false,
    );
  });
});

describe("editar lançamento gravado", () => {
  let ctx: Ctx;
  beforeEach(async () => {
    ctx = setup();
    await semear(ctx);
  });

  it("comando direto altera o valor e registra log", async () => {
    await ctx.bot.onText(mensagem("editar 2 valor 59,90"));
    expect(ultimaResposta(ctx)).toContain("Atualizado:");
    expect((await ctx.repo.buscarLancamentoPorId("a"))?.valor).toBe(59.9);
    expect(logs(ctx)).toHaveLength(1);
    expect(logs(ctx)[0]?.[3]).toBe("edicao");
    expect(JSON.parse(logs(ctx)[0]?.[4] ?? "{}")).toMatchObject({
      id: "a",
      campo: "valor",
      de: 54.9,
      para: 59.9,
    });
  });

  it("comando direto de categoria normaliza o nome", async () => {
    await ctx.bot.onCommand(
      "editar",
      "2 categoria lazer",
      mensagem("/editar 2 categoria lazer"),
    );
    expect((await ctx.repo.buscarLancamentoPorId("a"))?.categoria).toBe(
      "Lazer",
    );
  });

  it("rejeita valor inválido sem alterar nada", async () => {
    await ctx.bot.onText(mensagem("editar 2 valor abc"));
    expect(ultimaResposta(ctx)).toContain("Valor inválido");
    expect((await ctx.repo.buscarLancamentoPorId("a"))?.valor).toBe(54.9);
    expect(logs(ctx)).toHaveLength(0);
  });

  it("número inexistente e uso incorreto", async () => {
    await ctx.bot.onText(mensagem("editar 9 valor 10"));
    expect(ultimaResposta(ctx)).toContain("Não encontrei o lançamento 9");
    await ctx.bot.onText(mensagem("editar 1 preco 10"));
    expect(ultimaResposta(ctx)).toContain("Use: editar 1 valor 59,90");
  });

  it("fluxo por botões: lista -> campo -> novo valor", async () => {
    await ctx.bot.onText(mensagem("editar"));
    expect(
      callbacks(ctx.client.sendMessage.mock.calls[0]?.[2]?.inlineKeyboard),
    ).toEqual(["es:b", "es:a", "cx:0"]);

    await ctx.bot.onCallback(clique("es:a"));
    expect(ultimaEdicao(ctx)).toContain("O que deseja alterar?");

    await ctx.bot.onCallback(clique("ec:v:a"));
    expect(ultimaEdicao(ctx)).toContain("Envie o novo valor de Valor");

    // a próxima mensagem do usuário é o novo valor, e não um lançamento novo
    await ctx.bot.onText(mensagem("70"));
    expect((await ctx.repo.buscarLancamentoPorId("a"))?.valor).toBe(70);
    expect(ultimaEdicao(ctx)).toContain("Atualizado:");
    expect(ctx.sheets.dump("despesas")).toHaveLength(1);
    expect(ctx.sheets.dump("pendentes")).toHaveLength(0);
  });

  it("valor inválido na edição mantém a edição aberta", async () => {
    await ctx.bot.onCallback(clique("ec:d:a"));
    await ctx.bot.onText(mensagem("x".repeat(100)));
    expect(ultimaResposta(ctx)).toContain("muito longa");
    expect(ctx.sheets.dump("pendentes")).toHaveLength(1);
    await ctx.bot.onText(mensagem("padaria nova"));
    expect((await ctx.repo.buscarLancamentoPorId("a"))?.descricao).toBe(
      "Padaria Nova",
    );
  });

  it("cancelar a edição libera o texto para lançamentos normais", async () => {
    await ctx.bot.onCallback(clique("ec:v:a"));
    await ctx.bot.onCallback(clique("ea:id-1"));
    expect(ultimaEdicao(ctx)).toBe("Cancelado.");
    await ctx.bot.onText(mensagem("padaria 10"));
    expect(ultimaResposta(ctx)).toContain("Lançamento identificado");
  });

  it("edição aberta expira depois de 10 minutos", async () => {
    await ctx.bot.onCallback(clique("ec:v:a"));
    let agora = AGORA;
    const tarde = criarBot({
      client: ctx.client,
      repo: ctx.repo,
      store: new SheetsPendingStore(ctx.sheets),
      agora: () => agora,
      novoId: () => "id-futuro",
    });
    agora = new Date(AGORA.getTime() + 11 * 60 * 1000);
    await tarde.onText(mensagem("padaria 10"));
    expect(ultimaResposta(ctx)).toContain("Lançamento identificado");
    expect((await ctx.repo.buscarLancamentoPorId("a"))?.valor).toBe(54.9);
  });

  it("lançamento inexistente nos botões", async () => {
    await ctx.bot.onCallback(clique("es:nao-existe"));
    expect(ultimaEdicao(ctx)).toContain("Não encontrei esse lançamento");
  });
});

describe("excluir lançamento", () => {
  let ctx: Ctx;
  beforeEach(async () => {
    ctx = setup();
    await semear(ctx);
  });

  it("pede confirmação e só exclui no Sim", async () => {
    await ctx.bot.onText(mensagem("excluir 2"));
    expect(ultimaResposta(ctx)).toContain("Deseja realmente excluir?");
    expect(await ctx.repo.buscarLancamentoPorId("a")).not.toBeNull();

    await ctx.bot.onCallback(clique("xy:a"));
    expect(await ctx.repo.buscarLancamentoPorId("a")).toBeNull();
    expect(ultimaEdicao(ctx)).toContain("Excluído:");
    expect(logs(ctx)[0]?.[3]).toBe("exclusao");
    expect(JSON.parse(logs(ctx)[0]?.[4] ?? "{}")).toMatchObject({
      id: "a",
      descricao: "Padaria",
    });
  });

  it("Não cancela sem excluir", async () => {
    await ctx.bot.onCallback(clique("cx:0"));
    expect(ultimaEdicao(ctx)).toBe("Cancelado.");
    expect(await ctx.repo.buscarLancamentoPorId("a")).not.toBeNull();
  });

  it("clique duplo em Sim não falha nem registra duas vezes", async () => {
    await ctx.bot.onCallback(clique("xy:b"));
    await ctx.bot.onCallback(clique("xy:b"));
    expect(ultimaEdicao(ctx)).toContain("Não encontrei esse lançamento");
    expect(logs(ctx)).toHaveLength(1);
  });

  it("lista por botões", async () => {
    await ctx.bot.onText(mensagem("excluir"));
    expect(
      callbacks(ctx.client.sendMessage.mock.calls[0]?.[2]?.inlineKeyboard),
    ).toEqual(["xs:b", "xs:a", "cx:0"]);
    await ctx.bot.onCallback(clique("xs:b"));
    expect(ultimaEdicao(ctx)).toContain("Deseja realmente excluir?");
  });
});

describe("botão Editar na confirmação", () => {
  it("altera o rascunho antes de gravar e mantém a confirmação", async () => {
    const ctx = setup();
    await ctx.bot.onText(mensagem("padaria 54,90"));
    await ctx.bot.onCallback(clique("pe:id-1"));
    expect(ultimaEdicao(ctx)).toContain("O que deseja alterar?");

    await ctx.bot.onCallback(clique("pc:v:id-1"));
    await ctx.bot.onText(mensagem("49,90"));

    expect(ultimaEdicao(ctx)).toContain("Valor: R$ 49,90");
    expect(ctx.sheets.dump("despesas")).toHaveLength(0);

    await ctx.bot.onCallback(clique("ok:id-1"));
    expect(ctx.sheets.dump("despesas")).toHaveLength(1);
    expect(ctx.sheets.dump("despesas")[0]?.[4]).toBe("49.9");
    expect(logs(ctx)[0]?.[3]).toBe("criacao");
  });

  it("cancelar a edição volta para a confirmação", async () => {
    const ctx = setup();
    await ctx.bot.onText(mensagem("padaria 54,90"));
    await ctx.bot.onCallback(clique("pe:id-1"));
    await ctx.bot.onCallback(clique("pc:c:id-1"));
    await ctx.bot.onCallback(clique("ea:id-2"));
    expect(ultimaEdicao(ctx)).toContain("Confirmar?");
  });

  it("voltar mostra a confirmação de novo", async () => {
    const ctx = setup();
    await ctx.bot.onText(mensagem("padaria 54,90"));
    await ctx.bot.onCallback(clique("pe:id-1"));
    await ctx.bot.onCallback(clique("pv:id-1"));
    expect(ultimaEdicao(ctx)).toContain("Confirmar?");
  });

  it("pendente inexistente", async () => {
    const ctx = setup();
    await ctx.bot.onCallback(clique("pe:nada"));
    expect(ultimaEdicao(ctx)).toContain("expirou");
  });
});
