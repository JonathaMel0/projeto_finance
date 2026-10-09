import type { Despesa, Entrada, Lancamento, ResumoMensal } from "@/types/finance";

function somar(valores: number[]): number {
  return valores.reduce((total, valor) => total + valor, 0);
}

function agruparPorCategoria(itens: Array<{ categoria: string; valor: number }>) {
  const resultado: Record<string, number> = {};
  for (const item of itens) {
    resultado[item.categoria] = (resultado[item.categoria] ?? 0) + item.valor;
  }
  return resultado;
}

export function calcularResumoMensal(
  lancamentos: Lancamento[],
  ano: number,
  mes: number,
): ResumoMensal {
  const despesas = lancamentos.filter(
    (l): l is Despesa => l.tipo === "despesa",
  );
  const entradas = lancamentos.filter(
    (l): l is Entrada => l.tipo === "entrada",
  );

  const totalDespesas = somar(despesas.map((d) => d.valor));
  const totalEntradas = somar(entradas.map((e) => e.valor));

  return {
    ano,
    mes,
    totalDespesas,
    totalEntradas,
    saldo: totalEntradas - totalDespesas,
    quantidadeDespesas: despesas.length,
    quantidadeEntradas: entradas.length,
    despesasPorCategoria: agruparPorCategoria(despesas),
    entradasPorCategoria: agruparPorCategoria(entradas),
  };
}
