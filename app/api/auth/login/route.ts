import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { getAuthEnv } from "@/lib/auth/env";
import { destinoSeguro } from "@/lib/auth/guard";
import { verificarSenha } from "@/lib/auth/password";
import {
  bloqueado,
  limparFalhas,
  registrarFalha,
} from "@/lib/auth/rate-limit";
import {
  COOKIE_SESSAO,
  criarToken,
  DURACAO_SESSAO_SEGUNDOS,
} from "@/lib/auth/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function iguais(a: string, b: string): boolean {
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb);
}

function voltarAoLogin(request: Request, erro: string, next: string) {
  const url = new URL("/login", request.url);
  url.searchParams.set("erro", erro);
  if (next !== "/") url.searchParams.set("next", next);
  return NextResponse.redirect(url, 303);
}

export async function POST(request: Request) {
  const formulario = await request.formData().catch(() => null);
  const campo = (nome: string) => {
    const valor = formulario?.get(nome);
    return typeof valor === "string" ? valor : "";
  };
  const next = destinoSeguro(campo("next"));

  let env;
  try {
    env = getAuthEnv();
  } catch (error) {
    console.error("[auth] configuração inválida", error);
    return voltarAoLogin(request, "config", next);
  }

  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "desconhecido";
  if (bloqueado(ip)) return voltarAoLogin(request, "bloqueado", next);

  // A senha é sempre verificada, mesmo com usuário errado, para o tempo de
  // resposta não revelar se o usuário existe.
  const usuarioOk = iguais(campo("usuario"), env.username);
  const senhaOk = await verificarSenha(campo("senha"), env.passwordHash);

  if (!usuarioOk || !senhaOk) {
    registrarFalha(ip);
    return voltarAoLogin(request, "credenciais", next);
  }

  limparFalhas(ip);
  const resposta = NextResponse.redirect(new URL(next, request.url), 303);
  resposta.cookies.set(COOKIE_SESSAO, await criarToken(env.username, env.secret), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: DURACAO_SESSAO_SEGUNDOS,
  });
  return resposta;
}
