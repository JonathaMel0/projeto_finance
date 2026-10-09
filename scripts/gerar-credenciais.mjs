// Gera valores para as variáveis de login (Fase 7).
//
//   node scripts/gerar-credenciais.mjs --secret   -> linha AUTH_SECRET=...
//   node scripts/gerar-credenciais.mjs            -> pergunta a senha (sem
//                                                    eco) e imprime a linha
//                                                    ADMIN_PASSWORD_HASH=...
//
// A senha nunca é passada como argumento (ficaria no histórico do terminal) e
// nada é gravado em disco: copie a saída para o .env.local e para a Vercel.
// O formato do hash precisa ser o mesmo de lib/auth/password.ts.
import { randomBytes, scrypt } from "node:crypto";

const N = 16384;
const TAMANHO = 64;

function lerSenhaOculta(pergunta) {
  return new Promise((resolve) => {
    process.stderr.write(pergunta);
    let senha = "";
    const entrada = process.stdin;
    if (!entrada.isTTY) {
      let dados = "";
      entrada.on("data", (c) => (dados += c));
      entrada.on("end", () => resolve(dados.split(/\r?\n/)[0] ?? ""));
      return;
    }
    entrada.setRawMode(true);
    entrada.resume();
    entrada.setEncoding("utf8");
    entrada.on("data", function aoDigitar(tecla) {
      for (const c of tecla) {
        if (c === "\u0003") process.exit(130);
        if (c === "\r" || c === "\n") {
          entrada.setRawMode(false);
          entrada.pause();
          entrada.off("data", aoDigitar);
          process.stderr.write("\n");
          resolve(senha);
          return;
        }
        if (c === "\u007f" || c === "\b") senha = senha.slice(0, -1);
        else senha += c;
      }
    });
  });
}

function derivar(senha, salt) {
  return new Promise((resolve, reject) => {
    scrypt(senha, salt, TAMANHO, { N, r: 8, p: 1 }, (e, k) =>
      e ? reject(e) : resolve(k),
    );
  });
}

if (process.argv.includes("--secret")) {
  console.log(`AUTH_SECRET=${randomBytes(48).toString("base64url")}`);
} else {
  const senha = await lerSenhaOculta("Nova senha (mínimo 10 caracteres): ");
  if (senha.length < 10) {
    console.error("Senha muito curta.");
    process.exit(1);
  }
  const salt = randomBytes(16);
  const chave = await derivar(senha, salt);
  console.log(
    `ADMIN_PASSWORD_HASH=scrypt:${N}:${salt.toString("base64url")}:${chave.toString("base64url")}`,
  );
}
