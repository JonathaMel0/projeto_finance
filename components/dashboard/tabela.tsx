import { formatarData, formatarMoeda } from "@/lib/dashboard/formatar";
import type { Lancamento } from "@/types/finance";

export function TabelaLancamentos({
  lancamentos,
}: {
  lancamentos: Lancamento[];
}) {
  return (
    <section className="rounded-lg border border-gray-200 bg-white shadow-sm">
      <h2 className="px-4 pt-4 text-sm font-semibold text-gray-700">
        Lançamentos ({lancamentos.length})
      </h2>
      {lancamentos.length === 0 ? (
        <p className="p-4 text-sm text-gray-500">
          Nenhum lançamento para os filtros escolhidos.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="mt-3 w-full text-left text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th className="px-4 py-2">Data</th>
                <th className="px-4 py-2">Descrição</th>
                <th className="px-4 py-2">Categoria</th>
                <th className="px-4 py-2">Tipo</th>
                <th className="px-4 py-2">Pagamento</th>
                <th className="px-4 py-2 text-right">Valor</th>
              </tr>
            </thead>
            <tbody>
              {lancamentos.map((l) => (
                <tr key={l.id} className="border-t border-gray-100">
                  <td className="whitespace-nowrap px-4 py-2">
                    {formatarData(l.data)} {l.hora}
                  </td>
                  <td className="px-4 py-2">{l.descricao}</td>
                  <td className="px-4 py-2">{l.categoria}</td>
                  <td className="px-4 py-2">
                    {l.tipo === "entrada" ? "Entrada" : "Despesa"}
                  </td>
                  <td className="px-4 py-2">
                    {l.tipo === "despesa" ? l.formaPagamento : "—"}
                  </td>
                  <td
                    className={`whitespace-nowrap px-4 py-2 text-right font-medium ${
                      l.tipo === "entrada" ? "text-emerald-600" : "text-rose-600"
                    }`}
                  >
                    {l.tipo === "entrada" ? "+" : "-"}
                    {formatarMoeda(l.valor)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
