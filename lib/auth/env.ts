export interface AuthEnv {
  secret: string;
  username: string;
  passwordHash: string;
}

export const TAMANHO_MINIMO_SECRET = 32;

/** Lança com a lista do que falta; nunca inclui os valores na mensagem. */
export function getAuthEnv(): AuthEnv {
  const secret = process.env.AUTH_SECRET;
  const username = process.env.ADMIN_USERNAME;
  const passwordHash = process.env.ADMIN_PASSWORD_HASH;

  const problemas = [
    !secret && "AUTH_SECRET ausente",
    secret &&
      secret.length < TAMANHO_MINIMO_SECRET &&
      `AUTH_SECRET precisa ter ao menos ${TAMANHO_MINIMO_SECRET} caracteres`,
    !username && "ADMIN_USERNAME ausente",
    !passwordHash && "ADMIN_PASSWORD_HASH ausente",
  ].filter(Boolean);

  if (problemas.length > 0) {
    throw new Error(`Configuração de login inválida: ${problemas.join("; ")}.`);
  }
  return { secret: secret!, username: username!, passwordHash: passwordHash! };
}
