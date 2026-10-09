import { NextResponse, type NextRequest } from "next/server";
import { temAcesso } from "@/lib/auth/guard";
import { COOKIE_SESSAO } from "@/lib/auth/session";

export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const token = request.cookies.get(COOKIE_SESSAO)?.value;

  if (await temAcesso(pathname, token, process.env.AUTH_SECRET)) {
    return NextResponse.next();
  }

  // APIs respondem 401; páginas redirecionam para o login.
  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  const login = new URL("/login", request.url);
  if (pathname !== "/") login.searchParams.set("next", pathname + search);
  return NextResponse.redirect(login);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
