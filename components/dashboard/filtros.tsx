import Link from "next/link";
import type { FiltrosDashboard } from "@/lib/dashboard/dados";
import { MESES } from "@/lib/dashboard/dados";

const CAMPO =
  "w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm";

export function Filtros({
  filtros,
  opcoes,
}: {
  filtros: FiltrosDashboard;
  opcoes: { categorias: string[]; formasPagamento: string[]; anos: number[] };
}) {
  return (
    <form
      method="get"
      className="grid grid-cols-2 gap-3 rounded-lg border border-gray-200 bg-white p-4 shadow-sm sm:grid-cols-3 lg:grid-cols-6"
    >
      <label className="text-xs text-gray-600">
        Mês
        <select name="mes" defaultValue={filtros.mes} className={CAMPO}>
          {MESES.map((nome, i) => (
            <option key={nome} value={i + 1}>
              {nome}
            </option>
          ))}
        </select>
      </label>
      <label className="text-xs text-gray-600">
        Ano
        <select name="ano" defaultValue={filtros.ano} className={CAMPO}>
          {opcoes.anos.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
      </label>
      <label className="text-xs text-gray-600">
        Tipo
        <select name="tipo" defaultValue={filtros.tipo ?? ""} className={CAMPO}>
          <option value="">Todos</option>
          <option value="despesa">Despesa</option>
          <option value="entrada">Entrada</option>
        </select>
      </label>
      <label className="text-xs text-gray-600">
        Categoria
        <select
          name="categoria"
          defaultValue={filtros.categoria ?? ""}
          className={CAMPO}
        >
          <option value="">Todas</option>
          {opcoes.categorias.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </label>
      <label className="text-xs text-gray-600">
        Pagamento
        <select
          name="pagamento"
          defaultValue={filtros.formaPagamento ?? ""}
          className={CAMPO}
        >
          <option value="">Todas</option>
          {opcoes.formasPagamento.map((f) => (
            <option key={f} value={f}>
              {f}
            </option>
          ))}
        </select>
      </label>
      <div className="flex items-end gap-2">
        <button
          type="submit"
          className="rounded bg-gray-900 px-3 py-1.5 text-sm text-white hover:bg-gray-700"
        >
          Filtrar
        </button>
        <Link
          href="/"
          className="rounded border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-100"
        >
          Limpar
        </Link>
      </div>
    </form>
  );
}
