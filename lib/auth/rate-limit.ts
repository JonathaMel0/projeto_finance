/**
 * Limite simples de tentativas de login por IP, em memória. Em serverless
 * cada instância tem o seu contador, então é uma proteção "melhor esforço"
 * contra tentativas em série, não uma garantia.
 */
const MAX_FALHAS = 5;
const JANELA_MS = 15 * 60 * 1000;

const falhas = new Map<string, { quantidade: number; expiraEm: number }>();

export function bloqueado(chave: string, agora = Date.now()): boolean {
  const registro = falhas.get(chave);
  if (!registro) return false;
  if (registro.expiraEm <= agora) {
    falhas.delete(chave);
    return false;
  }
  return registro.quantidade >= MAX_FALHAS;
}

export function registrarFalha(chave: string, agora = Date.now()): void {
  const registro = falhas.get(chave);
  if (!registro || registro.expiraEm <= agora) {
    falhas.set(chave, { quantidade: 1, expiraEm: agora + JANELA_MS });
  } else {
    registro.quantidade += 1;
  }
}

export function limparFalhas(chave: string): void {
  falhas.delete(chave);
}
