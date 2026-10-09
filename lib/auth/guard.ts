import { verificarToken } from "./session";

/** Rotas que não exigem sessão: login, logout e o webhook do Telegram. */
const PUBLICAS = ["/login", "/api/auth", "/api/telegram"];

export function rotaPublica(pathname: string): boolean {
  return PUBLICAS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export async function temAcesso(
  pathname: string,
  token: string | undefined,
  secret: string | undefined,
): Promise<boolean> {
  if (rotaPublica(pathname)) return true;
  if (!secret) return false;
  return (await verificarToken(token, secret)) !== null;
}

/** Só aceita caminhos internos ("/x"), evitando redirecionar para outro site. */
export function destinoSeguro(next: string | null | undefined): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.includes("\\")) {
    return "/";
  }
  return next;
}
