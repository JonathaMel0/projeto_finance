import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/telegram/webhook/route";
import { handleUpdate } from "@/lib/telegram/handler";

vi.mock("@/lib/telegram/handler", () => ({ handleUpdate: vi.fn(async () => {}) }));
vi.mock("@/lib/google-sheets/client", () => ({ createGoogleSheetsClient: () => ({}) }));
vi.mock("@/lib/finance", () => ({ getFinanceRepository: () => ({}) }));

const SEGREDO = "segredo-do-webhook";

function requisicao(corpo: unknown, segredo: string | null = SEGREDO) {
  return new Request("http://localhost/api/telegram/webhook", {
    method: "POST",
    headers: segredo ? { "x-telegram-bot-api-secret-token": segredo } : {},
    body: typeof corpo === "string" ? corpo : JSON.stringify(corpo),
  });
}

describe("POST /api/telegram/webhook", () => {
  beforeEach(() => {
    vi.stubEnv("TELEGRAM_BOT_TOKEN", "token");
    vi.stubEnv("TELEGRAM_WEBHOOK_SECRET", SEGREDO);
    vi.stubEnv("AUTHORIZED_TELEGRAM_USERS", "1");
    vi.mocked(handleUpdate).mockClear();
  });
  afterEach(() => vi.unstubAllEnvs());

  it("responde 500 sem configuração", async () => {
    vi.stubEnv("TELEGRAM_BOT_TOKEN", "");
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect((await POST(requisicao({ update_id: 1 }))).status).toBe(500);
  });

  it("responde 401 com segredo ausente ou errado", async () => {
    expect((await POST(requisicao({ update_id: 1 }, null))).status).toBe(401);
    expect((await POST(requisicao({ update_id: 1 }, "errado"))).status).toBe(401);
    expect(handleUpdate).not.toHaveBeenCalled();
  });

  it("responde 400 com corpo inválido", async () => {
    expect((await POST(requisicao("{nao-json"))).status).toBe(400);
    expect((await POST(requisicao({ sem: "update_id" }))).status).toBe(400);
  });

  it("processa o update e ignora reentrega do mesmo update_id", async () => {
    expect((await POST(requisicao({ update_id: 9001 }))).status).toBe(200);
    expect((await POST(requisicao({ update_id: 9001 }))).status).toBe(200);
    expect(handleUpdate).toHaveBeenCalledTimes(1);
  });
});
