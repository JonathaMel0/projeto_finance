import { getFinanceRepository } from "@/lib/finance";
import { formatDateSaoPaulo, getHojeSaoPaulo } from "@/lib/finance/datetime";
import { createGoogleSheetsClient } from "@/lib/google-sheets/client";
import { calcularOrcamento } from "@/lib/budget/calculo";
import { carregarConfigOrcamento } from "@/lib/budget/config";
import { lerFiltros, montarDashboard } from "@/lib/dashboard/dados";
import { formatarMoeda, formatarPercentual } from "@/lib/dashboard/formatar";
import {
  FiltrosTabela,
  NavegacaoMes,
  SeletorPeriodo,
} from "@/components/dashboard/filtros";
import {
  GraficoCategorias,
  GraficoDiario,
  GraficoEvolucao,
} from "@/components/dashboard/graficos";
import { PainelOrcamento } from "@/components/dashboard/orcamento";
import { Painel } from "@/components/dashboard/painel";
import { TabelaLancamentos } from "@/components/dashboard/tabela";

export const dynamic = "force-dynamic";

function Indicador({
  titulo,
  valor,
  cor,
}: {
  titulo: string;
  valor: string;
  cor?: string;
}) {
  return (
    <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-200/70">
      <div className="flex items-center gap-2 text-xs text-slate-400">
        {cor && <span className={`h-1.5 w-1.5 rounded-full ${cor}`} />}
        {titulo}
      </div>
      <div className="mt-1.5 text-xl font-semibold tracking-tight tabular-nums">
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
  const hoje = getHojeSaoPaulo();
  const filtros = lerFiltros(await searchParams, hoje);

  let dados;
  let orcamento;
  let avisos: string[];
  try {
    const [todos, configuracao] = await Promise.all([
      getFinanceRepository().listarLancamentos(),
      carregarConfigOrcamento(createGoogleSheetsClient()),
    ]);
    dados = montarDashboard(todos, filtros, {
      saldoInicial: configuracao.saldoInicial,
      hoje: formatDateSaoPaulo(new Date()),
    });
    orcamento = calcularOrcamento(
      dados.resumo,
      configuracao.config,
      hoje,
      dados.baseOrcamento,
    );
    avisos = configuracao.avisos;
  } catch (erro) {
    console.error("Falha ao carregar o dashboard", erro);
    return (
      <main className="mx-auto max-w-5xl p-6">
        <p className="rounded-2xl bg-rose-50 p-5 text-sm text-rose-700 ring-1 ring-rose-100">
          Não foi possível ler a planilha. Verifique as variáveis do Google
          Sheets e tente novamente.
        </p>
      </main>
    );
  }

  const { resumo, taxaPoupanca, saldoEmConta } = dados;
  const investido = orcamento?.grupos.find((g) => g.grupo === "objetivo")?.realizado;

  return (
    <main className="mx-auto max-w-5xl space-y-5 px-4 py-6 sm:px-6 sm:py-10">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <NavegacaoMes filtros={filtros} atual={hoje} />
        <div className="flex items-center gap-3">
          <SeletorPeriodo filtros={filtros} anos={dados.opcoes.anos} />
          <form method="post" action="/api/auth/logout">
            <button
              type="submit"
              className="rounded-xl px-3 py-2 text-sm text-slate-500 transition hover:bg-white hover:text-slate-900"
            >
              Sair
            </button>
          </form>
        </div>
      </header>

      <section className="rounded-3xl bg-slate-900 p-6 text-white sm:p-8">
        <div className="text-sm text-slate-400">Saldo em conta</div>
        <div
          className={`mt-2 text-4xl font-semibold tracking-tight tabular-nums sm:text-5xl ${
            saldoEmConta < 0 ? "text-rose-300" : ""
          }`}
        >
          {formatarMoeda(saldoEmConta)}
        </div>
        <div className="mt-3 text-sm text-slate-400">
          Acumulado de todos os meses. No mês, o resultado é{" "}
          <span
            className={`font-medium tabular-nums ${
              resumo.saldo < 0 ? "text-rose-300" : "text-emerald-300"
            }`}
          >
            {resumo.saldo >= 0 ? "+" : "−"} {formatarMoeda(Math.abs(resumo.saldo))}
          </span>
          .
        </div>
      </section>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Indicador
          titulo="Entradas"
          valor={formatarMoeda(resumo.totalEntradas)}
          cor="bg-emerald-400"
        />
        <Indicador
          titulo="Despesas"
          valor={formatarMoeda(resumo.totalDespesas)}
          cor="bg-rose-400"
        />
        <Indicador
          titulo="Poupança"
          valor={taxaPoupanca === null ? "—" : formatarPercentual(taxaPoupanca)}
        />
        <Indicador
          titulo="Investido / guardado"
          valor={investido === undefined ? "—" : formatarMoeda(investido)}
        />
      </div>

      <PainelOrcamento orcamento={orcamento} avisos={avisos} />

      <div className="grid gap-5 lg:grid-cols-2">
        <GraficoCategorias
          itens={dados.categorias}
          total={resumo.totalDespesas}
        />
        <div className="space-y-5">
          <GraficoEvolucao pontos={dados.evolucao} />
          <GraficoDiario pontos={dados.diario} />
        </div>
      </div>

      <Painel titulo={`Lançamentos · ${dados.lancamentos.length}`}>
        <div className="space-y-4">
          <FiltrosTabela filtros={filtros} opcoes={dados.opcoes} />
          <TabelaLancamentos lancamentos={dados.lancamentos} />
        </div>
      </Painel>
    </main>
  );
}
