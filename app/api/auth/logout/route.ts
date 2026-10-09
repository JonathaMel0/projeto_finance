import { NextResponse } from "next/server";
import { COOKIE_SESSAO } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

/** Apenas POST: um link GET poderia ser acionado por terceiros. */
export async function POST(request: Request) {
  const resposta = NextResponse.redirect(new URL("/login", request.url), 303);
  resposta.cookies.set(COOKIE_SESSAO, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return resposta;
}
