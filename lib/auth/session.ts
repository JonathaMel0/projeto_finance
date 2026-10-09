/**
 * Sessão em cookie assinado (HMAC-SHA256), sem estado no servidor. Usa só
 * Web Crypto, para funcionar tanto nas rotas quanto no middleware (Edge).
 */
export const COOKIE_SESSAO = "sessao";
export const DURACAO_SESSAO_SEGUNDOS = 60 * 60 * 24 * 7;

const encoder = new TextEncoder();

function paraBase64Url(bytes: Uint8Array): string {
  let binario = "";
  for (const b of bytes) binario += String.fromCharCode(b);
  return btoa(binario).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function deBase64Url(texto: string): Uint8Array {
  const base64 = texto.replace(/-/g, "+").replace(/_/g, "/");
  const binario = atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, "="));
  return Uint8Array.from(binario, (c) => c.charCodeAt(0));
}

function chave(secret: string, usos: KeyUsage[]): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    usos,
  );
}

export async function criarToken(
  usuario: string,
  secret: string,
  agoraMs: number = Date.now(),
): Promise<string> {
  const exp = Math.floor(agoraMs / 1000) + DURACAO_SESSAO_SEGUNDOS;
  const payload = paraBase64Url(encoder.encode(JSON.stringify({ u: usuario, exp })));
  const assinatura = await crypto.subtle.sign(
    "HMAC",
    await chave(secret, ["sign"]),
    encoder.encode(payload),
  );
  return `${payload}.${paraBase64Url(new Uint8Array(assinatura))}`;
}

/** Devolve o usuário da sessão, ou `null` se inválida, adulterada ou expirada. */
export async function verificarToken(
  token: string | undefined,
  secret: string,
  agoraMs: number = Date.now(),
): Promise<string | null> {
  if (!token || !secret) return null;
  const partes = token.split(".");
  if (partes.length !== 2) return null;
  const [payload = "", assinatura = ""] = partes;

  try {
    const valida = await crypto.subtle.verify(
      "HMAC",
      await chave(secret, ["verify"]),
      deBase64Url(assinatura) as BufferSource,
      encoder.encode(payload),
    );
    if (!valida) return null;

    const dados = JSON.parse(new TextDecoder().decode(deBase64Url(payload))) as {
      u?: unknown;
      exp?: unknown;
    };
    if (typeof dados.u !== "string" || typeof dados.exp !== "number") return null;
    if (dados.exp * 1000 <= agoraMs) return null;
    return dados.u;
  } catch {
    return null;
  }
}
