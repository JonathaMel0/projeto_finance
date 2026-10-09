import type {
  ItemCategoria,
  PontoDiario,
  PontoEvolucao,
} from "@/lib/dashboard/dados";
import { MESES } from "@/lib/dashboard/dados";
import {
  formatarMoeda,
  formatarMoedaCompacta,
  formatarPercentual,
} from "@/lib/dashboard/formatar";
import { PALETA, Painel, SEM_DADOS } from "./painel";

export function GraficoCategorias({
  itens,
  total,
}: {
  itens: ItemCategoria[];
  total: number;
}) {
  let acumulado = 0;
  const fatias = itens.map((item, i) => {
    const inicio = acumulado;
    acumulado += item.percentual;
    return `${PALETA[i % PALETA.length]} ${inicio}% ${acumulado}%`;
  });

  return (
    <Painel titulo="Despesas por categoria">
      {itens.length === 0 ? (
        SEM_DADOS
      ) : (
        <div className="flex flex-col items-center gap-6 sm:flex-row">
          <div
            className="relative h-40 w-40 shrink-0 rounded-full"
            style={{ background: `conic-gradient(${fatias.join(", ")})` }}
            role="img"
            aria-label="Distribuição das despesas por categoria"
          >
            <div className="absolute inset-5 flex flex-col items-center justify-center rounded-full bg-white">
              <span className="text-xs text-slate-400">Total</span>
              <span className="text-sm font-semibold tabular-nums">
                {formatarMoeda(total)}
              </span>
            </div>
          </div>
          <ul className="w-full space-y-2.5">
            {itens.map((item, i) => (
              <li key={item.categoria} className="flex items-center gap-3 text-sm">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: PALETA[i % PALETA.length] }}
                />
                <span className="flex-1 truncate text-slate-700">{item.categoria}</span>
                <span className="tabular-nums text-slate-400">
                  {formatarPercentual(item.percentual)}
                </span>
                <span className="w-24 text-right font-medium tabular-nums">
                  {formatarMoeda(item.valor)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Painel>
  );
}

export function GraficoEvolucao({ pontos }: { pontos: PontoEvolucao[] }) {
  const max = Math.max(...pontos.flatMap((p) => [p.entradas, p.despesas]), 0);

  return (
    <Painel titulo="Evolução mensal">
      {max === 0 ? (
        SEM_DADOS
      ) : (
        <>
          <div className="flex h-40 items-end gap-2">
            {pontos.map((p) => (
              <div
                key={`${p.ano}-${p.mes}`}
                className="flex h-full flex-1 items-end justify-center gap-1"
              >
                <div
                  className="w-full max-w-4 rounded-full bg-emerald-400"
                  style={{ height: `${Math.max((p.entradas / max) * 100, 1.5)}%` }}
                  title={`Entradas: ${formatarMoeda(p.entradas)}`}
                />
                <div
                  className="w-full max-w-4 rounded-full bg-rose-400"
                  style={{ height: `${Math.max((p.despesas / max) * 100, 1.5)}%` }}
                  title={`Despesas: ${formatarMoeda(p.despesas)}`}
                />
              </div>
            ))}
          </div>
          <div className="mt-3 flex gap-2 border-t border-slate-100 pt-3">
            {pontos.map((p) => (
              <div key={`${p.ano}-${p.mes}`} className="flex-1 text-center">
                <div className="text-xs font-medium text-slate-600">
                  {MESES[p.mes - 1]?.slice(0, 3)}
                </div>
                <div
                  className={`text-[11px] tabular-nums ${
                    p.saldoAcumulado < 0 ? "text-rose-500" : "text-slate-400"
                  }`}
                  title="Saldo em conta ao fim do mês"
                >
                  {formatarMoedaCompacta(p.saldoAcumulado)}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-3 flex items-center gap-4 text-xs text-slate-500">
            <span className="flex items-center gap-1.5">
              <i className="h-2 w-2 rounded-full bg-emerald-400" /> Entradas
            </span>
            <span className="flex items-center gap-1.5">
              <i className="h-2 w-2 rounded-full bg-rose-400" /> Despesas
            </span>
            <span className="ml-auto text-slate-400">Abaixo: saldo em conta</span>
          </div>
        </>
      )}
    </Painel>
  );
}

export function GraficoDiario({ pontos }: { pontos: PontoDiario[] }) {
  const total = pontos.at(-1)?.acumulado ?? 0;
  const largura = 300;
  const altura = 100;
  const passo = pontos.length > 1 ? largura / (pontos.length - 1) : largura;
  const linha = pontos
    .map(
      (p, i) =>
        `${(i * passo).toFixed(1)},${(altura - (p.acumulado / total) * altura).toFixed(1)}`,
    )
    .join(" ");

  return (
    <Painel titulo="Gasto acumulado no mês">
      {total === 0 ? (
        SEM_DADOS
      ) : (
        <>
          <svg
            viewBox={`0 -4 ${largura} ${altura + 8}`}
            className="h-36 w-full"
            preserveAspectRatio="none"
            role="img"
            aria-label="Gasto acumulado por dia"
          >
            <defs>
              <linearGradient id="area-diaria" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#f43f5e" stopOpacity="0.25" />
                <stop offset="100%" stopColor="#f43f5e" stopOpacity="0" />
              </linearGradient>
            </defs>
            <polygon
              points={`0,${altura} ${linha} ${largura},${altura}`}
              fill="url(#area-diaria)"
            />
            <polyline
              points={linha}
              fill="none"
              stroke="#f43f5e"
              strokeWidth={2}
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
          </svg>
          <div className="mt-2 flex justify-between text-xs text-slate-400">
            <span>Dia 1</span>
            <span className="font-medium text-slate-600">
              {formatarMoeda(total)}
            </span>
            <span>Dia {pontos.length}</span>
          </div>
        </>
      )}
    </Painel>
  );
}
