import { formatarData, formatarMoeda } from "@/lib/dashboard/formatar";
import type { Lancamento } from "@/types/finance";

export function TabelaLancamentos({
  lancamentos,
}: {
  lancamentos: Lancamento[];
}) {
  if (lancamentos.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-slate-400">
        Nenhum lançamento para os filtros escolhidos.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="text-xs text-slate-400">
            <th className="py-2 pr-4 font-medium">Data</th>
            <th className="py-2 pr-4 font-medium">Descrição</th>
            <th className="hidden py-2 pr-4 font-medium sm:table-cell">Categoria</th>
            <th className="hidden py-2 pr-4 font-medium md:table-cell">Pagamento</th>
            <th className="py-2 text-right font-medium">Valor</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {lancamentos.map((l) => {
            const entrada = l.tipo === "entrada";
            return (
              <tr key={l.id} className="transition hover:bg-slate-50">
                <td className="whitespace-nowrap py-3 pr-4 text-slate-500">
                  {formatarData(l.data).slice(0, 5)}
                  <span className="ml-1.5 hidden text-xs text-slate-300 lg:inline">
                    {l.hora}
                  </span>
                </td>
                <td className="py-3 pr-4">
                  <div className="font-medium text-slate-800">{l.descricao}</div>
                  <div className="text-xs text-slate-400 sm:hidden">{l.categoria}</div>
                </td>
                <td className="hidden py-3 pr-4 sm:table-cell">
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600">
                    {l.categoria}
                  </span>
                </td>
                <td className="hidden py-3 pr-4 text-slate-500 md:table-cell">
                  {l.tipo === "despesa" ? l.formaPagamento : "—"}
                </td>
                <td
                  className={`whitespace-nowrap py-3 text-right font-medium tabular-nums ${
                    entrada ? "text-emerald-600" : "text-slate-800"
                  }`}
                >
                  {entrada ? "+" : "−"} {formatarMoeda(l.valor)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
