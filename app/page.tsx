import { getFinanceRepository } from "@/lib/finance";
import { getAnoMesAtual } from "@/lib/finance/datetime";
import { lerFiltros, MESES, montarDashboard } from "@/lib/dashboard/dados";
import { formatarMoeda, formatarPercentual } from "@/lib/dashboard/formatar";
import { Filtros } from "@/components/dashboard/filtros";
import {
  GraficoCategorias,
  GraficoDiario,
  GraficoEvolucao,
} from "@/components/dashboard/graficos";
import { TabelaLancamentos } from "@/components/dashboard/tabela";

export const dynamic = "force-dynamic";

function Card({
  titulo,
  valor,
  cor,
}: {
  titulo: string;
  valor: string;
  cor?: string;
}) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <div className="text-xs uppercase text-gray-500">{titulo}</div>
      <div className={`mt-1 text-2xl font-semibold ${cor ?? "text-gray-900"}`}>
        {valor}
      </div>
    </div>
  );
}

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const filtros = lerFiltros(await searchParams, getAnoMesAtual());

  let dados;
  try {
    const todos = await getFinanceRepository().listarLancamentos();
    dados = montarDashboard(todos, filtros);
  } catch (erro) {
    console.error("Falha ao carregar o dashboard", erro);
    return (
      <main className="mx-auto max-w-5xl p-6">
        <p className="rounded border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          Não foi possível ler a planilha. Verifique as variáveis do Google
          Sheets e tente novamente.
        </p>
      </main>
    );
  }

  const { resumo, taxaPoupanca } = dados;

  return (
    <main className="mx-auto max-w-5xl space-y-4 p-4 sm:p-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">
            Controle financeiro
          </h1>
          <p className="text-sm text-gray-600">
            {MESES[filtros.mes - 1]}/{filtros.ano}
          </p>
        </div>
        <form method="post" action="/api/auth/logout">
          <button
            type="submit"
            className="rounded border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-100"
          >
            Sair
          </button>
        </form>
      </header>

      <Filtros filtros={filtros} opcoes={dados.opcoes} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card
          titulo="Entradas"
          valor={formatarMoeda(resumo.totalEntradas)}
          cor="text-emerald-600"
        />
        <Card
          titulo="Despesas"
          valor={formatarMoeda(resumo.totalDespesas)}
          cor="text-rose-600"
        />
        <Card
          titulo="Saldo"
          valor={formatarMoeda(resumo.saldo)}
          cor={resumo.saldo < 0 ? "text-rose-600" : undefined}
        />
        <Card
          titulo="Poupança"
          valor={taxaPoupanca === null ? "—" : formatarPercentual(taxaPoupanca)}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <GraficoCategorias itens={dados.categorias} />
        <GraficoEvolucao pontos={dados.evolucao} />
      </div>
      <GraficoDiario pontos={dados.diario} />

      <TabelaLancamentos lancamentos={dados.lancamentos} />
    </main>
  );
}
