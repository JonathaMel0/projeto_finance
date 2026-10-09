import { isAuthorizedUser } from "./auth";
import type { TelegramClient } from "./client";
import type {
  TelegramCallbackQuery,
  TelegramMessage,
  TelegramUpdate,
} from "./types";

export const MSG_NAO_AUTORIZADO =
  "Você não possui autorização para utilizar este bot.";
export const MSG_ERRO_GENERICO =
  "Não consegui salvar seu lançamento agora. Tente novamente em alguns instantes.";

const MSG_AJUDA = [
  "Envie um lançamento e confirme nos botões:",
  "padaria 54,90",
  "salario valid 10900",
  "almoço 35 ontem",
  "aluguel 1500 dia 5",
  "uber 27,50 pix",
  "",
  "Comandos:",
  "/start - apresentação",
  "/ajuda - esta mensagem",
].join("\n");

export interface HandlerDeps {
  client: TelegramClient;
  authorizedUserIds: string[];
  /** Mensagens de texto livre (não comandos). */
  onText?: (message: TelegramMessage) => Promise<void>;
  /** Cliques em botões inline; é responsável por responder o callback. */
  onCallback?: (callback: TelegramCallbackQuery) => Promise<void>;
}

/**
 * Processa um update do Telegram. Nunca lança: falhas são registradas no
 * servidor e o usuário recebe apenas uma mensagem genérica.
 */
export async function handleUpdate(
  update: TelegramUpdate,
  deps: HandlerDeps,
): Promise<void> {
  const message = update.message;
  const callback = update.callback_query;
  const userId = message?.from?.id ?? callback?.from.id;
  const chatId = message?.chat.id ?? callback?.message?.chat.id;

  if (chatId === undefined) return;

  try {
    if (!isAuthorizedUser(userId, deps.authorizedUserIds)) {
      // O id vai para o log do servidor para facilitar autorizar alguém novo.
      console.warn("[telegram] usuário não autorizado", userId);
      if (callback) await deps.client.answerCallbackQuery(callback.id);
      // Em grupos o bot fica em silêncio para não poluir a conversa.
      const privado =
        (message?.chat.type ?? callback?.message?.chat.type) === "private";
      if (privado) await deps.client.sendMessage(chatId, MSG_NAO_AUTORIZADO);
      return;
    }

    if (callback) {
      if (deps.onCallback) await deps.onCallback(callback);
      else await deps.client.answerCallbackQuery(callback.id);
      return;
    }

    const text = message?.text?.trim();
    if (!message || !text) return;

    const command = parseCommand(text);
    if (command === "start") {
      await deps.client.sendMessage(
        chatId,
        "Olá! Sou seu bot de controle financeiro.\n\n" + MSG_AJUDA,
      );
    } else if (command === "ajuda") {
      await deps.client.sendMessage(chatId, MSG_AJUDA);
    } else if (command === null && deps.onText) {
      await deps.onText(message);
    } else {
      await deps.client.sendMessage(
        chatId,
        "Ainda não sei fazer isso. Use /ajuda para ver o que está disponível.",
      );
    }
  } catch (error) {
    console.error("[telegram] falha ao processar update", update.update_id, error);
    await deps.client.sendMessage(chatId, MSG_ERRO_GENERICO).catch(() => {});
  }
}

/** "/ajuda@MeuBot arg" -> "ajuda"; texto sem barra inicial -> null. */
export function parseCommand(text: string): string | null {
  if (!text.startsWith("/")) return null;
  const [head = ""] = text.slice(1).split(/\s+/);
  return (head.split("@")[0] ?? "").toLowerCase();
}
