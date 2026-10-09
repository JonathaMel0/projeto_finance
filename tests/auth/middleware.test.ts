import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { middleware } from "@/middleware";
import { COOKIE_SESSAO, criarToken } from "@/lib/auth/session";

const SECRET = "s".repeat(40);

function req(caminho: string, token?: string) {
  return new NextRequest(`http://localhost${caminho}`, {
    headers: token ? { cookie: `${COOKIE_SESSAO}=${token}` } : {},
  });
}

describe("middleware", () => {
  beforeEach(() => vi.stubEnv("AUTH_SECRET", SECRET));
  afterEach(() => vi.unstubAllEnvs());

  it("redireciona páginas sem sessão para o login, guardando o destino", async () => {
    const r = await middleware(req("/dashboard?mes=3"));
    expect(r.status).toBe(307);
    expect(r.headers.get("location")).toBe(
      "http://localhost/login?next=%2Fdashboard%3Fmes%3D3",
    );
  });

  it("não acrescenta next quando o destino é a raiz", async () => {
    const r = await middleware(req("/"));
    expect(r.headers.get("location")).toBe("http://localhost/login");
  });

  it("responde 401 para APIs sem sessão", async () => {
    expect((await middleware(req("/api/transactions"))).status).toBe(401);
  });

  it("deixa passar rotas públicas e o webhook do Telegram", async () => {
    for (const caminho of ["/login", "/api/auth/login", "/api/telegram/webhook"]) {
      expect((await middleware(req(caminho))).headers.get("location")).toBeNull();
    }
  });

  it("deixa passar com sessão válida e barra token de outro segredo", async () => {
    const valido = await criarToken("admin", SECRET);
    expect((await middleware(req("/", valido))).headers.get("x-middleware-next")).toBe("1");

    const forjado = await criarToken("admin", "outro-segredo-qualquer-com-32-caracteres");
    expect((await middleware(req("/", forjado))).status).toBe(307);
  });

  it("falha fechado sem AUTH_SECRET", async () => {
    vi.stubEnv("AUTH_SECRET", "");
    const valido = await criarToken("admin", SECRET);
    expect((await middleware(req("/", valido))).status).toBe(307);
  });
});
