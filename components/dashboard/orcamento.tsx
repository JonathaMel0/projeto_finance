import { ROTULO_GRUPO } from "@/lib/budget/config";
import type { Orcamento } from "@/lib/budget/calculo";
import { formatarMoeda } from "@/lib/dashboard/formatar";

export function PainelOrcamento({
  orcamento,
  avisos,
}: {
  orcamento: Orcamento | null;
  avisos: string[];
}) {
  return (
    <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <h2 className="mb-3 text-sm font-semibold text-gray-700">
        Orçamento do mês
      </h2>

      {avisos.length > 0 && (
        <ul className="mb-3 space-y-1 rounded bg-amber-50 p-3 text-xs text-amber-800">
          {avisos.map((aviso) => (
            <li key={aviso}>{aviso}</li>
          ))}
        </ul>
      )}

      {orcamento === null ? (
        <p className="text-sm text-gray-500">
          Registre uma entrada neste mês para calcular o orçamento.
        </p>
      ) : (
        <>
          <ul className="space-y-3">
            {orcamento.grupos.map((g) => {
              const pct =
                g.planejado > 0 ? Math.min((g.realizado / g.planejado) * 100, 100) : 0;
              const estourou = g.excesso > 0;
              return (
                <li key={g.grupo}>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-800">
                      {ROTULO_GRUPO[g.grupo]} ({g.percentual}%)
                    </span>
                    <span className={estourou ? "text-rose-600" : "text-gray-600"}>
                      {formatarMoeda(g.realizado)} / {formatarMoeda(g.planejado)}
                    </span>
                  </div>
                  <div className="mt-1 h-2 rounded bg-gray-100">
                    <div
                      className={`h-2 rounded ${
                        estourou
                          ? "bg-rose-500"
                          : g.grupo === "objetivo"
                            ? "bg-sky-500"
                            : "bg-emerald-500"
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>

          <div className="mt-4 rounded bg-gray-50 p-3">
            <div className="text-xs uppercase text-gray-500">
              Quanto ainda posso gastar
            </div>
            <div
              className={`text-2xl font-semibold ${
                orcamento.podeGastar < 0 ? "text-rose-600" : "text-gray-900"
              }`}
            >
              {formatarMoeda(orcamento.podeGastar)}
            </div>
            {orcamento.limiteDiario !== null && (
              <div className="text-sm text-gray-600">
                Limite médio diário: {formatarMoeda(orcamento.limiteDiario)}
              </div>
            )}
          </div>

          <ul className="mt-4 list-disc space-y-1 pl-5 text-sm text-gray-700">
            {orcamento.sugestoes.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-gray-500">
            Orientações baseadas nos percentuais configurados; não são
            aconselhamento financeiro profissional.
          </p>
        </>
      )}
    </section>
  );
}
