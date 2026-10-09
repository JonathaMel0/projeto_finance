import Link from "next/link";
import type { FiltrosDashboard } from "@/lib/dashboard/dados";
import { MESES } from "@/lib/dashboard/dados";

const SELECT =
  "w-full rounded-xl border-0 bg-slate-100 px-3 py-2 text-sm text-slate-700 outline-none ring-1 ring-transparent transition focus:bg-white focus:ring-slate-900";
const BOTAO =
  "rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700";

/** Query string preservando os filtros da tabela. */
export function hrefPeriodo(
  filtros: FiltrosDashboard,
  ano: number,
  mes: number,
): string {
  const q = new URLSearchParams({ ano: String(ano), mes: String(mes) });
  if (filtros.tipo) q.set("tipo", filtros.tipo);
  if (filtros.categoria) q.set("categoria", filtros.categoria);
  if (filtros.formaPagamento) q.set("pagamento", filtros.formaPagamento);
  return `/?${q.toString()}`;
}

function deslocar(ano: number, mes: number, delta: number) {
  const indice = ano * 12 + (mes - 1) + delta;
  return { ano: Math.floor(indice / 12), mes: (indice % 12) + 1 };
}

export function NavegacaoMes({
  filtros,
  atual,
}: {
  filtros: FiltrosDashboard;
  atual: { ano: number; mes: number };
}) {
  const anterior = deslocar(filtros.ano, filtros.mes, -1);
  const proximo = deslocar(filtros.ano, filtros.mes, 1);
  const noMesAtual = filtros.ano === atual.ano && filtros.mes === atual.mes;
  const seta =
    "flex h-9 w-9 items-center justify-center rounded-full text-slate-500 ring-1 ring-slate-200 transition hover:bg-white hover:text-slate-900";

  return (
    <div className="flex items-center gap-3">
      <Link
        href={hrefPeriodo(filtros, anterior.ano, anterior.mes)}
        className={seta}
        aria-label="Mês anterior"
      >
        ‹
      </Link>
      <h1 className="min-w-40 text-center text-2xl font-semibold tracking-tight">
        {MESES[filtros.mes - 1]}{" "}
        <span className="font-normal text-slate-400">{filtros.ano}</span>
      </h1>
      <Link
        href={hrefPeriodo(filtros, proximo.ano, proximo.mes)}
        className={seta}
        aria-label="Próximo mês"
      >
        ›
      </Link>
      {!noMesAtual && (
        <Link
          href={hrefPeriodo(filtros, atual.ano, atual.mes)}
          className="text-sm text-slate-500 underline-offset-4 hover:underline"
        >
          Hoje
        </Link>
      )}
    </div>
  );
}

interface Opcoes {
  categorias: string[];
  formasPagamento: string[];
}

/** Filtros que valem só para a tabela; mês e ano seguem como estão. */
export function FiltrosTabela({
  filtros,
  opcoes,
}: {
  filtros: FiltrosDashboard;
  opcoes: Opcoes;
}) {
  const filtrando = filtros.tipo || filtros.categoria || filtros.formaPagamento;
  return (
    <form method="get" className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-[1fr_1fr_1fr_auto_auto]">
      <input type="hidden" name="mes" value={filtros.mes} />
      <input type="hidden" name="ano" value={filtros.ano} />
      <select
        name="tipo"
        defaultValue={filtros.tipo ?? ""}
        className={SELECT}
        aria-label="Tipo"
      >
        <option value="">Todos os tipos</option>
        <option value="despesa">Despesas</option>
        <option value="entrada">Entradas</option>
      </select>
      <select
        name="categoria"
        defaultValue={filtros.categoria ?? ""}
        className={SELECT}
        aria-label="Categoria"
      >
        <option value="">Todas as categorias</option>
        {opcoes.categorias.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>
      <select
        name="pagamento"
        defaultValue={filtros.formaPagamento ?? ""}
        className={SELECT}
        aria-label="Forma de pagamento"
      >
        <option value="">Todos os pagamentos</option>
        {opcoes.formasPagamento.map((f) => (
          <option key={f} value={f}>
            {f}
          </option>
        ))}
      </select>
      <button type="submit" className={BOTAO}>
        Filtrar
      </button>
      {filtrando && (
        <Link
          href={hrefPeriodo(
            { ano: filtros.ano, mes: filtros.mes },
            filtros.ano,
            filtros.mes,
          )}
          className="flex items-center justify-center rounded-xl px-3 py-2 text-sm text-slate-500 hover:text-slate-900"
        >
          Limpar
        </Link>
      )}
    </form>
  );
}

/** Salto direto para outro mês/ano. */
export function SeletorPeriodo({
  filtros,
  anos,
}: {
  filtros: FiltrosDashboard;
  anos: number[];
}) {
  return (
    <form method="get" className="flex items-center gap-2">
      {filtros.tipo && <input type="hidden" name="tipo" value={filtros.tipo} />}
      {filtros.categoria && (
        <input type="hidden" name="categoria" value={filtros.categoria} />
      )}
      {filtros.formaPagamento && (
        <input type="hidden" name="pagamento" value={filtros.formaPagamento} />
      )}
      <select
        name="mes"
        defaultValue={filtros.mes}
        className={`${SELECT} w-auto`}
        aria-label="Mês"
      >
        {MESES.map((nome, i) => (
          <option key={nome} value={i + 1}>
            {nome}
          </option>
        ))}
      </select>
      <select
        name="ano"
        defaultValue={filtros.ano}
        className={`${SELECT} w-auto`}
        aria-label="Ano"
      >
        {anos.map((a) => (
          <option key={a} value={a}>
            {a}
          </option>
        ))}
      </select>
      <button type="submit" className={BOTAO}>
        Ir
      </button>
    </form>
  );
}
