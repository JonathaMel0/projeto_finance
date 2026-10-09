import { destinoSeguro } from "@/lib/auth/guard";

const MENSAGENS: Record<string, string> = {
  credenciais: "Usuário ou senha incorretos.",
  bloqueado: "Muitas tentativas. Aguarde alguns minutos e tente de novo.",
  config: "Login não configurado no servidor. Verifique as variáveis de ambiente.",
};

export const metadata = { title: "Entrar" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string; next?: string }>;
}) {
  const { erro, next } = await searchParams;
  const mensagem = erro ? (MENSAGENS[erro] ?? MENSAGENS.credenciais) : null;

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <form
        method="post"
        action="/api/auth/login"
        className="w-full max-w-sm space-y-4 rounded-lg border border-gray-200 p-6 shadow-sm"
      >
        <h1 className="text-2xl font-semibold">Entrar</h1>

        {mensagem && (
          <p role="alert" className="rounded bg-red-50 p-3 text-sm text-red-700">
            {mensagem}
          </p>
        )}

        <input type="hidden" name="next" value={destinoSeguro(next)} />

        <label className="block text-sm">
          Usuário
          <input
            name="usuario"
            type="text"
            autoComplete="username"
            required
            autoFocus
            className="mt-1 w-full rounded border border-gray-300 p-2"
          />
        </label>

        <label className="block text-sm">
          Senha
          <input
            name="senha"
            type="password"
            autoComplete="current-password"
            required
            className="mt-1 w-full rounded border border-gray-300 p-2"
          />
        </label>

        <button
          type="submit"
          className="w-full rounded bg-gray-900 p-2 font-medium text-white hover:bg-gray-700"
        >
          Entrar
        </button>
      </form>
    </main>
  );
}
