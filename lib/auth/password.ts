import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";

/**
 * Formato guardado em ADMIN_PASSWORD_HASH: "scrypt:<N>:<salt>:<hash>" (salt e
 * hash em base64url). Sem "$" de propósito: o Next expande "$VAR" em .env.
 */
const N = 16384;
const R = 8;
const P = 1;
const TAMANHO = 64;

function derivar(senha: string, salt: Buffer, custo: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(senha, salt, TAMANHO, { N: custo, r: R, p: P }, (erro, chave) =>
      erro ? reject(erro) : resolve(chave),
    );
  });
}

export async function hashSenha(senha: string): Promise<string> {
  const salt = randomBytes(16);
  const chave = await derivar(senha, salt, N);
  return `scrypt:${N}:${salt.toString("base64url")}:${chave.toString("base64url")}`;
}

/** Compara em tempo constante; hash malformado nunca autentica. */
export async function verificarSenha(
  senha: string,
  armazenado: string,
): Promise<boolean> {
  const [algoritmo, custoTexto, saltTexto, hashTexto, ...resto] =
    armazenado.split(":");
  const custo = Number(custoTexto);
  if (
    algoritmo !== "scrypt" ||
    resto.length > 0 ||
    !saltTexto ||
    !hashTexto ||
    !Number.isInteger(custo) ||
    custo < 1024 ||
    custo > 1 << 20
  ) {
    return false;
  }
  try {
    const esperado = Buffer.from(hashTexto, "base64url");
    const obtido = await derivar(senha, Buffer.from(saltTexto, "base64url"), custo);
    return esperado.length === obtido.length && timingSafeEqual(esperado, obtido);
  } catch {
    return false;
  }
}
