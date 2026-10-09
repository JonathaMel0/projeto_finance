import { beforeEach, describe, expect, it, vi } from "vitest";
import { GoogleSheetsFinanceRepository } from "@/lib/finance/google-sheets-repository";
import {
  criarFluxo,
  MSG_CANCELADO,
  MSG_EXPIRADO,
  MSG_JA_REGISTRADO,
} from "@/lib/telegram/fluxo";
import { SheetsPendingStore } from "@/lib/telegram/pending-store";
import type {
  TelegramCallbackQuery,
  TelegramMessage,
} from "@/lib/telegram/types";
import { FakeSheetsClient } from "../helpers/fake-sheets-client";

const CHAT = 99;
const USER = 123456789;
// 15:00 UTC = 12:00 em São Paulo, 30/09/2026
const AGORA = new Date("2026-09-30T15:00:00.000Z");

function setup(agora: () => Date = () => AGORA) {
  const sheets = new FakeSheetsClient();
  const client = {
    sendMessage: vi.fn().mockResolvedValue(undefined),
    answerCallbackQuery: vi.fn().mockResolvedValue(undefined),
    editMessageText: vi.fn().mockResolvedValue(undefined),
  };
  let n = 0;
  const fluxo = criarFluxo({
    client,
    repo: new GoogleSheetsFinanceRepository(sheets),
    store: new SheetsPendingStore(sheets),
    agora,
    novoId: () => `id-${++n}`,
  });
  return { sheets, client, fluxo };
}

function mensagem(
  text: string,
  chatType: "private" | "supergroup" = "private",
): TelegramMessage {
  return {
    message_id: 7,
    from: { id: USER },
    chat: { id: CHAT, type: chatType },
    date: 0,
    text,
  };
}

function clique(data: string, chatId = CHAT): TelegramCallbackQuery {
  return {
    id: "cb",
    from: { id: USER },
    message: {
      message_id: 8,
      chat: { id: chatId, type: "private" },
      date: 0,
    },
    data,
  };
}

function botoes(client: ReturnType<typeof setup>["client"]): string[] {
  const opcoes = client.sendMessage.mock.calls[0]?.[2];
  return (opcoes?.inlineKeyboard ?? [])
    .flat()
    .map((b: { callback_data: string }) => b.callback_data);
}

let ctx: ReturnType<typeof setup>;
beforeEach(() => {
  ctx = setup();
});

describe("confirmação de lançamento", () => {
  it("pede confirmação sem gravar nada", async () => {
    await ctx.fluxo.onText(mensagem("padaria 54,90"));

    const [chat, texto] = ctx.client.sendMessage.mock.calls[0] ?? [];
    expect(chat).toBe(CHAT);
    expect(texto).toContain("Tipo: Despesa");
    expect(texto).toContain("Descrição: Padaria");
    expect(texto).toContain("Valor: R$ 54,90");
    expect(texto).toContain("Categoria: Alimentação");
    expect(texto).toContain("Data: 30/09/2026");
    expect(botoes(ctx.client)).toEqual(["ok:id-1", "no:id-1"]);
    expect(ctx.sheets.dump("despesas")).toHaveLength(0);
    expect(ctx.sheets.dump("pendentes")).toHaveLength(1);
  });

  it("confirmar grava a despesa com o ID do pendente e mostra os totais", async () => {
    await ctx.fluxo.onText(mensagem("padaria 54,90"));
    await ctx.fluxo.onText(mensagem("mercado 100"));
    await ctx.fluxo.onCallback(clique("ok:id-1"));
    await ctx.fluxo.onCallback(clique("ok:id-2"));

    const linhas = ctx.sheets.dump("despesas");
    expect(linhas).toHaveLength(2);
    const [id, data, , descricao, valor, categoria, forma, , origem, userId] =
      linhas[0] ?? [];
    expect([id, data, descricao, valor, categoria, forma, origem, userId]).toEqual([
      "id-1",
      "2026-09-30",
      "Padaria",
      "54.9",
      "Alimentação",
      "não informado",
      "telegram",
      String(USER),
    ]);
    expect(ctx.sheets.dump("pendentes")).toHaveLength(0);

    const ultimo = ctx.client.editMessageText.mock.calls.at(-1)?.[2];
    expect(ultimo).toContain("Registrado.");
    expect(ultimo).toContain("Despesa: R$ 100,00");
    expect(ultimo).toContain("Total gasto hoje: R$ 154,90");
    expect(ultimo).toContain("Total gasto no mês: R$ 154,90");
  });

  it("clique repetido em Confirmar não duplica o lançamento", async () => {
    await ctx.fluxo.onText(mensagem("padaria 54,90"));
    await ctx.fluxo.onCallback(clique("ok:id-1"));
    await ctx.fluxo.onCallback(clique("ok:id-1"));

    expect(ctx.sheets.dump("despesas")).toHaveLength(1);
    expect(ctx.client.editMessageText.mock.calls.at(-1)?.[2]).toBe(
      MSG_JA_REGISTRADO,
    );
  });

  it("não duplica se o pendente sobrou após a gravação", async () => {
    await ctx.fluxo.onText(mensagem("padaria 54,90"));
    await ctx.fluxo.onCallback(clique("ok:id-1"));
    // simula falha ao limpar o pendente: ele reaparece
    const store = new SheetsPendingStore(ctx.sheets);
    await store.salvar({
      id: "id-1",
      chatId: CHAT,
      userId: USER,
      criadoEm: AGORA.toISOString(),
      conteudo: {
        kind: "lancamento",
        lancamento: {
          tipo: "despesa",
          descricao: "Padaria",
          valor: 54.9,
          categoria: "Alimentação",
        },
      },
    });
    await ctx.fluxo.onCallback(clique("ok:id-1"));

    expect(ctx.sheets.dump("despesas")).toHaveLength(1);
    expect(ctx.sheets.dump("pendentes")).toHaveLength(0);
  });

  it("cancelar descarta sem gravar", async () => {
    await ctx.fluxo.onText(mensagem("padaria 54,90"));
    await ctx.fluxo.onCallback(clique("no:id-1"));

    expect(ctx.sheets.dump("despesas")).toHaveLength(0);
    expect(ctx.sheets.dump("pendentes")).toHaveLength(0);
    expect(ctx.client.editMessageText.mock.calls.at(-1)?.[2]).toBe(MSG_CANCELADO);
  });

  it("grava entrada na aba entradas", async () => {
    await ctx.fluxo.onText(mensagem("salario valid 10900"));
    await ctx.fluxo.onCallback(clique("ok:id-1"));

    expect(ctx.sheets.dump("despesas")).toHaveLength(0);
    const [linha] = ctx.sheets.dump("entradas");
    expect(linha?.slice(3, 6)).toEqual(["Salário Valid", "10900", "Salário"]);
    expect(ctx.client.editMessageText.mock.calls.at(-1)?.[2]).toContain(
      "Total de entradas no mês: R$ 10.900,00",
    );
  });

  it("respeita data e forma de pagamento informadas", async () => {
    await ctx.fluxo.onText(mensagem("almoço 35 ontem pix"));
    await ctx.fluxo.onCallback(clique("ok:id-1"));

    const [linha] = ctx.sheets.dump("despesas");
    expect(linha?.[1]).toBe("2026-09-29");
    expect(linha?.[6]).toBe("Pix");
    // total "hoje" não inclui a despesa de ontem
    expect(ctx.client.editMessageText.mock.calls.at(-1)?.[2]).toContain(
      "Total gasto hoje: R$ 0,00",
    );
  });
});

describe("tipo incerto", () => {
  it("pergunta entrada ou despesa e depois pede confirmação", async () => {
    await ctx.fluxo.onText(mensagem("pix joao 200"));
    expect(ctx.client.sendMessage.mock.calls[0]?.[1]).toContain(
      "Não consegui identificar se isso é uma entrada ou despesa.",
    );
    expect(botoes(ctx.client)).toEqual(["e:id-1", "d:id-1", "no:id-1"]);

    await ctx.fluxo.onCallback(clique("e:id-1"));
    const [, , texto, opcoes] = ctx.client.editMessageText.mock.calls[0] ?? [];
    expect(texto).toContain("Tipo: Entrada");
    expect(texto).toContain("Descrição: Pix Joao");
    expect(opcoes.inlineKeyboard.flat().map((b: { callback_data: string }) => b.callback_data)).toEqual([
      "ok:id-1",
      "no:id-1",
    ]);
    expect(ctx.sheets.dump("entradas")).toHaveLength(0);

    await ctx.fluxo.onCallback(clique("ok:id-1"));
    expect(ctx.sheets.dump("entradas")).toHaveLength(1);
  });

  it("escolher despesa usa Pix como forma de pagamento", async () => {
    await ctx.fluxo.onText(mensagem("pix joao 200"));
    await ctx.fluxo.onCallback(clique("d:id-1"));
    await ctx.fluxo.onCallback(clique("ok:id-1"));

    const [linha] = ctx.sheets.dump("despesas");
    expect(linha?.[3]).toBe("Joao");
    expect(linha?.[6]).toBe("Pix");
  });
});

describe("mensagens inválidas e grupos", () => {
  it("no privado, explica o problema", async () => {
    await ctx.fluxo.onText(mensagem("padaria"));
    expect(ctx.client.sendMessage.mock.calls[0]?.[1]).toContain(
      "Não encontrei um valor",
    );
    expect(ctx.sheets.dump("pendentes")).toHaveLength(0);
  });

  it("em grupo, ignora conversa sem criar nada", async () => {
    await ctx.fluxo.onText(mensagem("bom dia pessoal", "supergroup"));
    await ctx.fluxo.onText(mensagem("quanto gastei", "supergroup"));
    expect(ctx.client.sendMessage).not.toHaveBeenCalled();
    expect(ctx.sheets.dump("pendentes")).toHaveLength(0);
  });

  it("em grupo, responde à mensagem original", async () => {
    await ctx.fluxo.onText(mensagem("padaria 54,90", "supergroup"));
    expect(ctx.client.sendMessage.mock.calls[0]?.[2]).toMatchObject({
      replyToMessageId: 7,
    });
  });
});

describe("pendentes inválidos", () => {
  it("avisa quando o pendente não existe mais", async () => {
    await ctx.fluxo.onCallback(clique("ok:inexistente"));
    expect(ctx.client.editMessageText.mock.calls[0]?.[2]).toBe(MSG_EXPIRADO);
    expect(ctx.sheets.dump("despesas")).toHaveLength(0);
  });

  it("expira depois de 24h", async () => {
    let agora = AGORA;
    const c = setup(() => agora);
    await c.fluxo.onText(mensagem("padaria 54,90"));
    agora = new Date(AGORA.getTime() + 25 * 60 * 60 * 1000);
    await c.fluxo.onCallback(clique("ok:id-1"));

    expect(c.client.editMessageText.mock.calls[0]?.[2]).toBe(MSG_EXPIRADO);
    expect(c.sheets.dump("despesas")).toHaveLength(0);
    expect(c.sheets.dump("pendentes")).toHaveLength(0);
  });

  it("ignora clique vindo de outro chat", async () => {
    await ctx.fluxo.onText(mensagem("padaria 54,90"));
    await ctx.fluxo.onCallback(clique("ok:id-1", 12345));
    expect(ctx.sheets.dump("despesas")).toHaveLength(0);
    expect(ctx.sheets.dump("pendentes")).toHaveLength(1);
  });

  it("ignora callback_data desconhecido", async () => {
    await ctx.fluxo.onCallback(clique("lixo"));
    expect(ctx.client.editMessageText).not.toHaveBeenCalled();
  });
});
