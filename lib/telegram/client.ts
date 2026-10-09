import type { SendMessageOptions } from "./types";

export interface TelegramClient {
  sendMessage(
    chatId: number,
    text: string,
    options?: SendMessageOptions,
  ): Promise<void>;
  answerCallbackQuery(callbackQueryId: string, text?: string): Promise<void>;
  /** Sem `inlineKeyboard`, os botões da mensagem são removidos. */
  editMessageText(
    chatId: number,
    messageId: number,
    text: string,
    options?: Pick<SendMessageOptions, "inlineKeyboard">,
  ): Promise<void>;
}

export class TelegramApiError extends Error {
  constructor(method: string, status: number, description: string) {
    super(`Telegram ${method} falhou (${status}): ${description}`);
    this.name = "TelegramApiError";
  }
}

export class HttpTelegramClient implements TelegramClient {
  constructor(
    private readonly botToken: string,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async sendMessage(
    chatId: number,
    text: string,
    options: SendMessageOptions = {},
  ): Promise<void> {
    await this.call("sendMessage", {
      chat_id: chatId,
      text,
      reply_to_message_id: options.replyToMessageId,
      reply_markup: options.inlineKeyboard
        ? { inline_keyboard: options.inlineKeyboard }
        : undefined,
    });
  }

  async answerCallbackQuery(
    callbackQueryId: string,
    text?: string,
  ): Promise<void> {
    await this.call("answerCallbackQuery", {
      callback_query_id: callbackQueryId,
      text,
    });
  }

  async editMessageText(
    chatId: number,
    messageId: number,
    text: string,
    options: Pick<SendMessageOptions, "inlineKeyboard"> = {},
  ): Promise<void> {
    await this.call("editMessageText", {
      chat_id: chatId,
      message_id: messageId,
      text,
      reply_markup: options.inlineKeyboard
        ? { inline_keyboard: options.inlineKeyboard }
        : { inline_keyboard: [] },
    });
  }

  private async call(method: string, body: Record<string, unknown>) {
    const response = await this.fetchImpl(
      `https://api.telegram.org/bot${this.botToken}/${method}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
    );
    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as {
        description?: string;
      } | null;
      throw new TelegramApiError(
        method,
        response.status,
        payload?.description ?? "sem descrição",
      );
    }
  }
}
