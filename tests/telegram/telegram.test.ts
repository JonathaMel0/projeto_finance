import { describe, expect, it, vi } from "vitest";
import { isAuthorizedUser, isValidWebhookSecret } from "@/lib/telegram/auth";
import { HttpTelegramClient, TelegramApiError } from "@/lib/telegram/client";
import { parseAuthorizedUsers } from "@/lib/telegram/env";
import {
  handleUpdate,
  MSG_ERRO_GENERICO,
  MSG_NAO_AUTORIZADO,
  parseCommand,
} from "@/lib/telegram/handler";
import { UpdateDeduplicator } from "@/lib/telegram/idempotency";
import type { TelegramUpdate } from "@/lib/telegram/types";

function fakeClient() {
  return {
    sendMessage: vi.fn().mockResolvedValue(undefined),
    answerCallbackQuery: vi.fn().mockResolvedValue(undefined),
    editMessageText: vi.fn().mockResolvedValue(undefined),
  };
}

function textUpdate(
  text: string,
  userId = 1,
  chatType: "private" | "supergroup" = "private",
): TelegramUpdate {
  return {
    update_id: 10,
    message: {
      message_id: 5,
      from: { id: userId },
      chat: { id: 99, type: chatType },
      date: 0,
      text,
    },
  };
}

describe("auth", () => {
  it("valida o segredo do webhook", () => {
    expect(isValidWebhookSecret("abc", "abc")).toBe(true);
    expect(isValidWebhookSecret("abd", "abc")).toBe(false);
    expect(isValidWebhookSecret("abcd", "abc")).toBe(false);
    expect(isValidWebhookSecret(null, "abc")).toBe(false);
  });

  it("autoriza apenas ids da lista e falha fechado sem lista", () => {
    expect(isAuthorizedUser(1, ["1", "2"])).toBe(true);
    expect(isAuthorizedUser(3, ["1", "2"])).toBe(false);
    expect(isAuthorizedUser(1, [])).toBe(false);
    expect(isAuthorizedUser(undefined, ["1"])).toBe(false);
  });

  it("parseia a lista de usuários autorizados", () => {
    expect(parseAuthorizedUsers(" 1, 2 ,,3 ")).toEqual(["1", "2", "3"]);
    expect(parseAuthorizedUsers(undefined)).toEqual([]);
  });
});

describe("UpdateDeduplicator", () => {
  it("detecta update repetido", () => {
    const d = new UpdateDeduplicator();
    expect(d.seenBefore(1)).toBe(false);
    expect(d.seenBefore(1)).toBe(true);
    expect(d.seenBefore(2)).toBe(false);
  });

  it("descarta os mais antigos ao exceder o limite", () => {
    const d = new UpdateDeduplicator(2);
    d.seenBefore(1);
    d.seenBefore(2);
    d.seenBefore(3);
    expect(d.seenBefore(1)).toBe(false);
  });
});

describe("parseCommand", () => {
  it("extrai comandos, inclusive com @bot e argumentos", () => {
    expect(parseCommand("/start")).toBe("start");
    expect(parseCommand("/Ajuda@MeuBot x")).toBe("ajuda");
    expect(parseCommand("padaria 54,90")).toBeNull();
  });
});

describe("handleUpdate", () => {
  it("recusa usuário não autorizado sem processar", async () => {
    const client = fakeClient();
    const onText = vi.fn();
    await handleUpdate(textUpdate("padaria 54,90", 7), {
      client,
      authorizedUserIds: ["1"],
      onText,
    });
    expect(client.sendMessage).toHaveBeenCalledWith(99, MSG_NAO_AUTORIZADO);
    expect(onText).not.toHaveBeenCalled();
  });

  it("fica em silêncio com usuário não autorizado em grupo", async () => {
    const client = fakeClient();
    const onText = vi.fn();
    vi.spyOn(console, "warn").mockImplementation(() => {});
    await handleUpdate(textUpdate("padaria 54,90", 7, "supergroup"), {
      client,
      authorizedUserIds: ["1"],
      onText,
    });
    expect(client.sendMessage).not.toHaveBeenCalled();
    expect(onText).not.toHaveBeenCalled();
  });

  it("encaminha cliques de botão para onCallback", async () => {
    const client = fakeClient();
    const onCallback = vi.fn().mockResolvedValue(undefined);
    const callback = {
      id: "cb1",
      from: { id: 1 },
      message: { message_id: 1, chat: { id: 99, type: "private" as const }, date: 0 },
      data: "ok:abc",
    };
    await handleUpdate(
      { update_id: 12, callback_query: callback },
      { client, authorizedUserIds: ["1"], onCallback },
    );
    expect(onCallback).toHaveBeenCalledWith(callback);
  });

  it("responde /start e /ajuda", async () => {
    const client = fakeClient();
    await handleUpdate(textUpdate("/start"), {
      client,
      authorizedUserIds: ["1"],
    });
    await handleUpdate(textUpdate("/ajuda"), {
      client,
      authorizedUserIds: ["1"],
    });
    expect(client.sendMessage).toHaveBeenCalledTimes(2);
  });

  it("encaminha texto livre para onText", async () => {
    const client = fakeClient();
    const onText = vi.fn().mockResolvedValue(undefined);
    await handleUpdate(textUpdate("padaria 54,90"), {
      client,
      authorizedUserIds: ["1"],
      onText,
    });
    expect(onText).toHaveBeenCalledOnce();
  });

  it("devolve mensagem genérica se o processamento falhar", async () => {
    const client = fakeClient();
    vi.spyOn(console, "error").mockImplementation(() => {});
    await handleUpdate(textUpdate("padaria 54,90"), {
      client,
      authorizedUserIds: ["1"],
      onText: vi.fn().mockRejectedValue(new Error("sheets fora do ar")),
    });
    expect(client.sendMessage).toHaveBeenCalledWith(99, MSG_ERRO_GENERICO);
  });

  it("encerra o loading de callbacks de usuário autorizado", async () => {
    const client = fakeClient();
    await handleUpdate(
      {
        update_id: 11,
        callback_query: {
          id: "cb1",
          from: { id: 1 },
          message: {
            message_id: 1,
            chat: { id: 99, type: "private" },
            date: 0,
          },
          data: "x",
        },
      },
      { client, authorizedUserIds: ["1"] },
    );
    expect(client.answerCallbackQuery).toHaveBeenCalledWith("cb1");
  });
});

describe("HttpTelegramClient", () => {
  it("envia sendMessage com teclado inline", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true });
    const client = new HttpTelegramClient("TOKEN", fetchImpl as never);
    await client.sendMessage(1, "oi", {
      inlineKeyboard: [[{ text: "OK", callback_data: "ok" }]],
    });
    const [url, init] = fetchImpl.mock.calls[0] ?? [];
    expect(url).toBe("https://api.telegram.org/botTOKEN/sendMessage");
    expect(JSON.parse(init.body).reply_markup.inline_keyboard[0][0].text).toBe(
      "OK",
    );
  });

  it("lança TelegramApiError em resposta não-ok", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ description: "bad" }),
    });
    const client = new HttpTelegramClient("TOKEN", fetchImpl as never);
    await expect(client.sendMessage(1, "oi")).rejects.toBeInstanceOf(
      TelegramApiError,
    );
  });
});
