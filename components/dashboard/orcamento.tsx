import { ROTULO_GRUPO } from "@/lib/budget/config";
import type { Orcamento } from "@/lib/budget/calculo";
import { formatarMoeda } from "@/lib/dashboard/formatar";
import { Painel } from "./painel";

const COR_BARRA = {
  necessidade: "bg-emerald-400",
  desejo: "bg-indigo-400",
  objetivo: "bg-sky-400",
} as const;

export function PainelOrcamento({
  orcamento,
  avisos,
}: {
  orcamento: Orcamento | null;
  avisos: string[];
}) {
  return (
    <Painel titulo="Orçamento do mês">
      {avisos.length > 0 && (
        <ul className="mb-4 space-y-1 rounded-xl bg-amber-50 px-4 py-3 text-xs text-amber-800">
          {avisos.map((aviso) => (
            <li key={aviso}>{aviso}</li>
          ))}
        </ul>
      )}

      {orcamento === null ? (
        <p className="py-6 text-center text-sm text-slate-400">
          Sem saldo positivo em conta para distribuir. Se o saldo do site
          estiver diferente do banco, ajuste `saldo_inicial` na aba configuracoes.
        </p>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <div>
            <div className="text-xs text-slate-400">Quanto ainda posso gastar</div>
            <div
              className={`mt-1 text-3xl font-semibold tracking-tight tabular-nums ${
                orcamento.podeGastar < 0 ? "text-rose-600" : "text-slate-900"
              }`}
            >
              {formatarMoeda(orcamento.podeGastar)}
            </div>
            {orcamento.limiteDiario !== null && (
              <div className="mt-1 text-sm text-slate-500">
                cerca de {formatarMoeda(orcamento.limiteDiario)} por dia
              </div>
            )}

            <ul className="mt-5 space-y-1.5 text-sm text-slate-600">
              {orcamento.sugestoes.map((s) => (
                <li key={s} className="leading-snug">
                  {s}
                </li>
              ))}
            </ul>
          </div>

          <ul className="space-y-5">
            {orcamento.grupos.map((g) => {
              const pct =
                g.planejado > 0 ? Math.min((g.realizado / g.planejado) * 100, 100) : 0;
              const estourou = g.excesso > 0;
              return (
                <li key={g.grupo}>
                  <div className="flex items-baseline justify-between text-sm">
                    <span className="font-medium text-slate-700">
                      {ROTULO_GRUPO[g.grupo]}{" "}
                      <span className="font-normal text-slate-400">{g.percentual}%</span>
                    </span>
                    <span
                      className={`tabular-nums ${estourou ? "text-rose-600" : "text-slate-500"}`}
                    >
                      {formatarMoeda(g.realizado)}{" "}
                      <span className="text-slate-300">/</span>{" "}
                      {formatarMoeda(g.planejado)}
                    </span>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className={`h-full rounded-full ${estourou ? "bg-rose-400" : COR_BARRA[g.grupo]}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </li>
              );
            })}
            <li className="pt-1 text-xs text-slate-400">
              Orientações baseadas nos percentuais configurados; não são
              aconselhamento financeiro profissional.
            </li>
          </ul>
        </div>
      )}
    </Painel>
  );
}
