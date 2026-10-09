export interface TelegramEnv {
  botToken: string;
  webhookSecret: string;
  authorizedUserIds: string[];
}

export function getTelegramEnv(): TelegramEnv {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET;

  const missing = [
    !botToken && "TELEGRAM_BOT_TOKEN",
    !webhookSecret && "TELEGRAM_WEBHOOK_SECRET",
  ].filter(Boolean);

  if (missing.length > 0) {
    throw new Error(
      `Variáveis de ambiente do Telegram ausentes: ${missing.join(", ")}. Veja .env.example.`,
    );
  }

  return {
    botToken: botToken!,
    webhookSecret: webhookSecret!,
    authorizedUserIds: parseAuthorizedUsers(
      process.env.AUTHORIZED_TELEGRAM_USERS,
    ),
  };
}

/** Converte "123, 456" em ["123", "456"], ignorando vazios. */
export function parseAuthorizedUsers(raw: string | undefined): string[] {
  return (raw ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
}
