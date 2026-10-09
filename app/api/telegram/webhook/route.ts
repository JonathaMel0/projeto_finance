import { NextResponse } from "next/server";
import { getFinanceRepository } from "@/lib/finance";
import { createGoogleSheetsClient } from "@/lib/google-sheets/client";
import { isValidWebhookSecret } from "@/lib/telegram/auth";
import { HttpTelegramClient } from "@/lib/telegram/client";
import { getTelegramEnv, type TelegramEnv } from "@/lib/telegram/env";
import { criarFluxo } from "@/lib/telegram/fluxo";
import { handleUpdate } from "@/lib/telegram/handler";
import { UpdateDeduplicator } from "@/lib/telegram/idempotency";
import { SheetsPendingStore } from "@/lib/telegram/pending-store";
import type { TelegramUpdate } from "@/lib/telegram/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const deduplicator = new UpdateDeduplicator();

export async function POST(request: Request) {
  let env: TelegramEnv;
  try {
    env = getTelegramEnv();
  } catch (error) {
    console.error("[telegram] configuração inválida", error);
    return NextResponse.json({ ok: false }, { status: 500 });
  }

  const secret = request.headers.get("x-telegram-bot-api-secret-token");
  if (!isValidWebhookSecret(secret, env.webhookSecret)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  let update: TelegramUpdate;
  try {
    update = (await request.json()) as TelegramUpdate;
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  if (typeof update?.update_id !== "number") {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  // Sempre responde 200 após validar, para o Telegram não reenviar o update.
  if (!deduplicator.seenBefore(update.update_id)) {
    const client = new HttpTelegramClient(env.botToken);
    const fluxo = criarFluxo({
      client,
      repo: getFinanceRepository(),
      store: new SheetsPendingStore(createGoogleSheetsClient()),
    });
    await handleUpdate(update, {
      client,
      authorizedUserIds: env.authorizedUserIds,
      onText: fluxo.onText,
      onCallback: fluxo.onCallback,
    });
  }

  return NextResponse.json({ ok: true });
}
