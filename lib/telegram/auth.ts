import { timingSafeEqual } from "node:crypto";

/**
 * Compara o header `X-Telegram-Bot-Api-Secret-Token` com o segredo esperado
 * em tempo constante.
 */
export function isValidWebhookSecret(
  received: string | null | undefined,
  expected: string,
): boolean {
  if (!received) return false;
  const a = Buffer.from(received);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Sem lista configurada, ninguém é autorizado (falha fechada). */
export function isAuthorizedUser(
  userId: number | undefined,
  authorizedIds: string[],
): boolean {
  if (userId === undefined) return false;
  return authorizedIds.includes(String(userId));
}
