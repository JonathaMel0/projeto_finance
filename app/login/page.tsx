import { destinoSeguro } from "@/lib/auth/guard";

const MENSAGENS: Record<string, string> = {
  credenciais: "Usuário ou senha incorretos.",
  bloqueado: "Muitas tentativas. Aguarde alguns minutos e tente de novo.",
  config: "Login não configurado no servidor. Verifique as variáveis de ambiente.",
};

export const metadata = { title: "Entrar" };

const CAMPO =
  "mt-1.5 w-full rounded-xl border-0 bg-slate-100 px-3.5 py-2.5 text-sm outline-none ring-1 ring-transparent transition focus:bg-white focus:ring-slate-900";

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
        className="w-full max-w-sm space-y-5 rounded-3xl bg-white p-8 ring-1 ring-slate-200/70"
      >
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Despesas</h1>
          <p className="mt-1 text-sm text-slate-500">Entre para ver suas finanças.</p>
        </div>

        {mensagem && (
          <p role="alert" className="rounded-xl bg-rose-50 px-3.5 py-2.5 text-sm text-rose-700">
            {mensagem}
          </p>
        )}

        <input type="hidden" name="next" value={destinoSeguro(next)} />

        <label className="block text-sm font-medium text-slate-600">
          Usuário
          <input
            name="usuario"
            type="text"
            autoComplete="username"
            required
            autoFocus
            className={CAMPO}
          />
        </label>

        <label className="block text-sm font-medium text-slate-600">
          Senha
          <input
            name="senha"
            type="password"
            autoComplete="current-password"
            required
            className={CAMPO}
          />
        </label>

        <button
          type="submit"
          className="w-full rounded-xl bg-slate-900 py-2.5 text-sm font-medium text-white transition hover:bg-slate-700"
        >
          Entrar
        </button>
      </form>
    </main>
  );
}
