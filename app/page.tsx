export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8">
      <h1 className="text-3xl font-semibold">Despesas</h1>
      <p className="mt-2 text-gray-600">
        Você está logado. O dashboard será adicionado na próxima etapa.
      </p>
      <form method="post" action="/api/auth/logout" className="mt-6">
        <button
          type="submit"
          className="rounded border border-gray-300 px-4 py-2 text-sm hover:bg-gray-100"
        >
          Sair
        </button>
      </form>
    </main>
  );
}
