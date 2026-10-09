import type {
  ItemCategoria,
  PontoDiario,
  PontoEvolucao,
} from "@/lib/dashboard/dados";
import { MESES } from "@/lib/dashboard/dados";
import { formatarMoeda, formatarPercentual } from "@/lib/dashboard/formatar";

function Painel({
  titulo,
  children,
}: {
  titulo: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <h2 className="mb-3 text-sm font-semibold text-gray-700">{titulo}</h2>
      {children}
    </section>
  );
}

const VAZIO = <p className="text-sm text-gray-500">Sem dados no período.</p>;

export function GraficoCategorias({ itens }: { itens: ItemCategoria[] }) {
  return (
    <Painel titulo="Despesas por categoria">
      {itens.length === 0 ? (
        VAZIO
      ) : (
        <ul className="space-y-3">
          {itens.map((item) => (
            <li key={item.categoria}>
              <div className="flex justify-between text-sm">
                <span className="text-gray-800">{item.categoria}</span>
                <span className="text-gray-600">
                  {formatarMoeda(item.valor)} ·{" "}
                  {formatarPercentual(item.percentual)}
                </span>
              </div>
              <div className="mt-1 h-2 rounded bg-gray-100">
                <div
                  className="h-2 rounded bg-emerald-500"
                  style={{ width: `${item.percentual}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </Painel>
  );
}

export function GraficoEvolucao({ pontos }: { pontos: PontoEvolucao[] }) {
  const max = Math.max(...pontos.flatMap((p) => [p.entradas, p.despesas]), 0);
  const vazio = max === 0;

  return (
    <Painel titulo="Evolução mensal">
      {vazio ? (
        VAZIO
      ) : (
        <>
          <div className="flex h-44 items-end gap-3">
            {pontos.map((p) => (
              <div
                key={`${p.ano}-${p.mes}`}
                className="flex h-full flex-1 flex-col justify-end"
              >
                <div className="flex flex-1 items-end justify-center gap-1">
                  <div
                    className="w-1/2 rounded-t bg-emerald-500"
                    style={{ height: `${(p.entradas / max) * 100}%` }}
                    title={`Entradas: ${formatarMoeda(p.entradas)}`}
                  />
                  <div
                    className="w-1/2 rounded-t bg-rose-500"
                    style={{ height: `${(p.despesas / max) * 100}%` }}
                    title={`Despesas: ${formatarMoeda(p.despesas)}`}
                  />
                </div>
                <div className="mt-1 text-center text-xs text-gray-500">
                  {MESES[p.mes - 1]?.slice(0, 3)}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-3 flex gap-4 text-xs text-gray-600">
            <span className="flex items-center gap-1">
              <i className="inline-block h-2 w-2 rounded bg-emerald-500" />
              Entradas
            </span>
            <span className="flex items-center gap-1">
              <i className="inline-block h-2 w-2 rounded bg-rose-500" />
              Despesas
            </span>
          </div>
          <ul className="mt-3 space-y-1 text-xs text-gray-600">
            {pontos.map((p) => (
              <li
                key={`${p.ano}-${p.mes}`}
                className="flex justify-between gap-2"
              >
                <span>
                  {MESES[p.mes - 1]}/{p.ano}
                </span>
                <span className={p.saldo < 0 ? "text-rose-600" : undefined}>
                  Saldo {formatarMoeda(p.saldo)}
                </span>
              </li>
            ))}
          </ul>
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
    <Painel titulo="Despesas ao longo do mês (acumulado)">
      {total === 0 ? (
        VAZIO
      ) : (
        <>
          <svg
            viewBox={`-2 -4 ${largura + 4} ${altura + 8}`}
            className="h-40 w-full"
            preserveAspectRatio="none"
            role="img"
            aria-label="Gasto acumulado por dia"
          >
            <polygon
              points={`0,${altura} ${linha} ${largura},${altura}`}
              className="fill-rose-100"
            />
            <polyline
              points={linha}
              fill="none"
              strokeWidth={2}
              vectorEffect="non-scaling-stroke"
              className="stroke-rose-500"
            />
          </svg>
          <div className="mt-1 flex justify-between text-xs text-gray-500">
            <span>Dia 1</span>
            <span>
              Total {formatarMoeda(total)} · dia {pontos.length}
            </span>
          </div>
        </>
      )}
    </Painel>
  );
}
