import { execFileSync } from "node:child_process";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST as login } from "@/app/api/auth/login/route";
import { POST as logout } from "@/app/api/auth/logout/route";
import { getAuthEnv } from "@/lib/auth/env";
import { destinoSeguro, rotaPublica, temAcesso } from "@/lib/auth/guard";
import { hashSenha, verificarSenha } from "@/lib/auth/password";
import { bloqueado, limparFalhas, registrarFalha } from "@/lib/auth/rate-limit";
import {
  COOKIE_SESSAO,
  criarToken,
  DURACAO_SESSAO_SEGUNDOS,
  verificarToken,
} from "@/lib/auth/session";

const SECRET = "x".repeat(40);

describe("senha", () => {
  it("aceita a senha certa e rejeita a errada", async () => {
    const hash = await hashSenha("senha-correta-123");
    expect(hash.startsWith("scrypt:")).toBe(true);
    expect(hash).not.toContain("$");
    expect(hash).not.toContain("senha-correta-123");
    expect(await verificarSenha("senha-correta-123", hash)).toBe(true);
    expect(await verificarSenha("senha-errada", hash)).toBe(false);
  });

  it("gera hashes diferentes para a mesma senha (salt)", async () => {
    expect(await hashSenha("abc")).not.toBe(await hashSenha("abc"));
  });

  it("hash malformado nunca autentica", async () => {
    for (const ruim of ["", "texto", "scrypt:1:a:b", "md5:16384:a:b", "scrypt:16384::"]) {
      expect(await verificarSenha("qualquer", ruim)).toBe(false);
    }
  });

  it("aceita o hash gerado pelo script gerar-credenciais", async () => {
    const saida = execFileSync("node", ["scripts/gerar-credenciais.mjs"], {
      input: "senha-do-script-1\n",
      encoding: "utf8",
    });
    const hash = saida.trim().replace(/^ADMIN_PASSWORD_HASH=/, "");
    expect(await verificarSenha("senha-do-script-1", hash)).toBe(true);
    expect(await verificarSenha("outra", hash)).toBe(false);
  });

  it("o script gera um AUTH_SECRET longo", () => {
    const saida = execFileSync("node", ["scripts/gerar-credenciais.mjs", "--secret"], {
      encoding: "utf8",
    });
    expect(saida.trim().replace("AUTH_SECRET=", "").length).toBeGreaterThanOrEqual(32);
  });
});

describe("sessão", () => {
  const agora = Date.parse("2026-10-09T12:00:00Z");

  it("token válido devolve o usuário", async () => {
    const token = await criarToken("admin", SECRET, agora);
    expect(await verificarToken(token, SECRET, agora + 1000)).toBe("admin");
  });

  it("expira depois de 7 dias", async () => {
    const token = await criarToken("admin", SECRET, agora);
    const limite = agora + DURACAO_SESSAO_SEGUNDOS * 1000;
    expect(await verificarToken(token, SECRET, limite - 1000)).toBe("admin");
    expect(await verificarToken(token, SECRET, limite + 1000)).toBeNull();
  });

  it("rejeita segredo diferente, adulteração e lixo", async () => {
    const token = await criarToken("admin", SECRET, agora);
    expect(await verificarToken(token, "y".repeat(40), agora)).toBeNull();

    const [payload, assinatura] = token.split(".");
    const outro = btoa(JSON.stringify({ u: "root", exp: 9999999999 }))
      .replace(/=+$/, "");
    expect(await verificarToken(`${outro}.${assinatura}`, SECRET, agora)).toBeNull();
    expect(await verificarToken(`${payload}.AAAA`, SECRET, agora)).toBeNull();

    for (const lixo of [undefined, "", "abc", "a.b.c", "...", "%%%.%%%"]) {
      expect(await verificarToken(lixo, SECRET, agora)).toBeNull();
    }
  });
});

describe("guard", () => {
  it("rotas públicas", () => {
    expect(rotaPublica("/login")).toBe(true);
    expect(rotaPublica("/api/telegram/webhook")).toBe(true);
    expect(rotaPublica("/api/auth/login")).toBe(true);
    expect(rotaPublica("/")).toBe(false);
    expect(rotaPublica("/dashboard")).toBe(false);
    expect(rotaPublica("/loginx")).toBe(false);
    expect(rotaPublica("/api/authx")).toBe(false);
  });

  it("exige sessão válida nas demais rotas", async () => {
    const token = await criarToken("admin", SECRET);
    expect(await temAcesso("/", token, SECRET)).toBe(true);
    expect(await temAcesso("/", undefined, SECRET)).toBe(false);
    expect(await temAcesso("/", "invalido", SECRET)).toBe(false);
    // sem AUTH_SECRET configurado, tudo (exceto as públicas) fica fechado
    expect(await temAcesso("/", token, undefined)).toBe(false);
    expect(await temAcesso("/login", undefined, undefined)).toBe(true);
  });

  it("destinoSeguro evita redirecionamento para outro site", () => {
    expect(destinoSeguro("/dashboard?x=1")).toBe("/dashboard?x=1");
    for (const ruim of ["https://evil.com", "//evil.com", "/\\evil.com", "evil", "", null, undefined]) {
      expect(destinoSeguro(ruim)).toBe("/");
    }
  });
});

describe("rate limit", () => {
  it("bloqueia após 5 falhas e libera depois da janela", () => {
    const ip = "1.2.3.4";
    const t0 = 1_000_000;
    for (let i = 0; i < 4; i++) registrarFalha(ip, t0);
    expect(bloqueado(ip, t0)).toBe(false);
    registrarFalha(ip, t0);
    expect(bloqueado(ip, t0)).toBe(true);
    expect(bloqueado(ip, t0 + 16 * 60 * 1000)).toBe(false);
    limparFalhas(ip);
  });
});

describe("env", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("lista o que falta sem vazar valores", () => {
    vi.stubEnv("AUTH_SECRET", "curto");
    vi.stubEnv("ADMIN_USERNAME", "");
    vi.stubEnv("ADMIN_PASSWORD_HASH", "");
    expect(() => getAuthEnv()).toThrow(/ao menos 32.*ADMIN_USERNAME.*ADMIN_PASSWORD_HASH/);
    expect(() => getAuthEnv()).not.toThrow(/curto/);
  });
});

describe("rotas de login e logout", () => {
  let hash: string;

  beforeEach(async () => {
    hash ??= await hashSenha("senha-longa-123");
    vi.stubEnv("AUTH_SECRET", SECRET);
    vi.stubEnv("ADMIN_USERNAME", "jonatha");
    vi.stubEnv("ADMIN_PASSWORD_HASH", hash);
  });
  afterEach(() => vi.unstubAllEnvs());

  function requisicao(campos: Record<string, string>, ip = "9.9.9.9") {
    return new Request("https://app.test/api/auth/login", {
      method: "POST",
      headers: { "x-forwarded-for": ip },
      body: new URLSearchParams(campos),
    });
  }

  it("login correto cria cookie de sessão e redireciona", async () => {
    const resposta = await login(
      requisicao({ usuario: "jonatha", senha: "senha-longa-123", next: "/" }, "10.0.0.1"),
    );
    expect(resposta.status).toBe(303);
    expect(new URL(resposta.headers.get("location") ?? "").pathname).toBe("/");

    const cookie = resposta.cookies.get(COOKIE_SESSAO);
    expect(cookie?.httpOnly).toBe(true);
    expect(cookie?.sameSite).toBe("lax");
    expect(cookie?.maxAge).toBe(DURACAO_SESSAO_SEGUNDOS);
    expect(await verificarToken(cookie?.value, SECRET)).toBe("jonatha");
  });

  it("respeita o destino interno e ignora destino externo", async () => {
    const ok = await login(
      requisicao({ usuario: "jonatha", senha: "senha-longa-123", next: "/dashboard" }, "10.0.0.2"),
    );
    expect(new URL(ok.headers.get("location") ?? "").pathname).toBe("/dashboard");

    const externo = await login(
      requisicao({ usuario: "jonatha", senha: "senha-longa-123", next: "https://evil.com" }, "10.0.0.3"),
    );
    expect(new URL(externo.headers.get("location") ?? "").host).toBe("app.test");
  });

  it("senha ou usuário errados voltam ao login sem cookie", async () => {
    for (const [usuario, senha] of [
      ["jonatha", "errada"],
      ["outro", "senha-longa-123"],
    ] as const) {
      const resposta = await login(requisicao({ usuario, senha }, `10.1.0.${usuario.length}`));
      const destino = new URL(resposta.headers.get("location") ?? "");
      expect(destino.pathname).toBe("/login");
      expect(destino.searchParams.get("erro")).toBe("credenciais");
      expect(resposta.cookies.get(COOKIE_SESSAO)).toBeUndefined();
    }
  });

  it("bloqueia o IP depois de 5 falhas, mesmo com a senha certa", async () => {
    const ip = "10.2.0.1";
    for (let i = 0; i < 5; i++) {
      await login(requisicao({ usuario: "jonatha", senha: "errada" }, ip));
    }
    const resposta = await login(
      requisicao({ usuario: "jonatha", senha: "senha-longa-123" }, ip),
    );
    expect(new URL(resposta.headers.get("location") ?? "").searchParams.get("erro")).toBe(
      "bloqueado",
    );
    expect(resposta.cookies.get(COOKIE_SESSAO)).toBeUndefined();
  });

  it("sem configuração o login falha fechado", async () => {
    vi.stubEnv("AUTH_SECRET", "");
    const resposta = await login(
      requisicao({ usuario: "jonatha", senha: "senha-longa-123" }, "10.3.0.1"),
    );
    expect(new URL(resposta.headers.get("location") ?? "").searchParams.get("erro")).toBe(
      "config",
    );
    expect(resposta.cookies.get(COOKIE_SESSAO)).toBeUndefined();
  });

  it("logout limpa o cookie", async () => {
    const resposta = await logout(
      new Request("https://app.test/api/auth/logout", { method: "POST" }),
    );
    expect(resposta.status).toBe(303);
    expect(resposta.cookies.get(COOKIE_SESSAO)?.value).toBe("");
    expect(resposta.cookies.get(COOKIE_SESSAO)?.maxAge).toBe(0);
  });
});
