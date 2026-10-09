import { prefixoAnoMes } from "@/lib/finance/datetime";
import { calcularResumoMensal } from "@/lib/finance/resumo";
import type {
  Lancamento,
  ResumoMensal,
  TipoLancamento,
} from "@/types/finance";

export const MESES = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

const MESES_EVOLUCAO = 6;

export interface FiltrosDashboard {
  ano: number;
  mes: number;
  categoria?: string;
  tipo?: TipoLancamento;
  formaPagamento?: string;
}

export interface PontoEvolucao {
  ano: number;
  mes: number;
  entradas: number;
  despesas: number;
  saldo: number;
}

export interface PontoDiario {
  dia: number;
  valor: number;
  acumulado: number;
}

export interface ItemCategoria {
  categoria: string;
  valor: number;
  percentual: number;
}

export interface DadosDashboard {
  resumo: ResumoMensal;
  taxaPoupanca: number | null;
  categorias: ItemCategoria[];
  evolucao: PontoEvolucao[];
  diario: PontoDiario[];
  lancamentos: Lancamento[];
  opcoes: { categorias: string[]; formasPagamento: string[]; anos: number[] };
}

type SearchParams = Record<string, string | string[] | undefined>;

function primeiro(valor: string | string[] | undefined): string | undefined {
  const v = Array.isArray(valor) ? valor[0] : valor;
  return v?.trim() ? v.trim() : undefined;
}

/** Lê os filtros da URL, caindo no mês atual quando ausentes ou inválidos. */
export function lerFiltros(
  params: SearchParams,
  atual: { ano: number; mes: number },
): FiltrosDashboard {
  const mes = Number(primeiro(params.mes));
  const ano = Number(primeiro(params.ano));
  const tipo = primeiro(params.tipo);

  return {
    mes: Number.isInteger(mes) && mes >= 1 && mes <= 12 ? mes : atual.mes,
    ano: Number.isInteger(ano) && ano >= 2000 && ano <= 2100 ? ano : atual.ano,
    categoria: primeiro(params.categoria),
    tipo: tipo === "despesa" || tipo === "entrada" ? tipo : undefined,
    formaPagamento: primeiro(params.pagamento),
  };
}

function formaPagamentoDe(l: Lancamento): string | undefined {
  return l.tipo === "despesa" ? l.formaPagamento : undefined;
}

function doMes(lancamentos: Lancamento[], ano: number, mes: number) {
  const prefixo = prefixoAnoMes(ano, mes);
  return lancamentos.filter((l) => l.data.startsWith(prefixo));
}

export function montarCategorias(
  porCategoria: Record<string, number>,
): ItemCategoria[] {
  const total = Object.values(porCategoria).reduce((a, b) => a + b, 0);
  return Object.entries(porCategoria)
    .map(([categoria, valor]) => ({
      categoria,
      valor,
      percentual: total > 0 ? (valor / total) * 100 : 0,
    }))
    .sort((a, b) => b.valor - a.valor);
}

export function montarEvolucao(
  lancamentos: Lancamento[],
  ano: number,
  mes: number,
  meses = MESES_EVOLUCAO,
): PontoEvolucao[] {
  const pontos: PontoEvolucao[] = [];
  for (let i = meses - 1; i >= 0; i--) {
    const indice = ano * 12 + (mes - 1) - i;
    const a = Math.floor(indice / 12);
    const m = (indice % 12) + 1;
    const r = calcularResumoMensal(doMes(lancamentos, a, m), a, m);
    pontos.push({
      ano: a,
      mes: m,
      entradas: r.totalEntradas,
      despesas: r.totalDespesas,
      saldo: r.saldo,
    });
  }
  return pontos;
}

export function montarDiario(
  lancamentos: Lancamento[],
  ano: number,
  mes: number,
): PontoDiario[] {
  const diasNoMes = new Date(ano, mes, 0).getDate();
  const porDia = new Array<number>(diasNoMes + 1).fill(0);
  for (const l of lancamentos) {
    if (l.tipo !== "despesa") continue;
    const dia = Number(l.data.slice(8, 10));
    if (dia >= 1 && dia <= diasNoMes) porDia[dia] = (porDia[dia] ?? 0) + l.valor;
  }
  let acumulado = 0;
  const pontos: PontoDiario[] = [];
  for (let dia = 1; dia <= diasNoMes; dia++) {
    const valor = porDia[dia] ?? 0;
    acumulado += valor;
    pontos.push({ dia, valor, acumulado });
  }
  return pontos;
}

/**
 * Mês e ano definem o período do resumo e dos gráficos; categoria, tipo e
 * forma de pagamento filtram apenas a tabela de lançamentos.
 */
export function montarDashboard(
  todos: Lancamento[],
  filtros: FiltrosDashboard,
): DadosDashboard {
  const { ano, mes } = filtros;
  const doPeriodo = doMes(todos, ano, mes);
  const resumo = calcularResumoMensal(doPeriodo, ano, mes);

  const tabela = doPeriodo
    .filter((l) => !filtros.tipo || l.tipo === filtros.tipo)
    .filter((l) => !filtros.categoria || l.categoria === filtros.categoria)
    .filter(
      (l) =>
        !filtros.formaPagamento ||
        formaPagamentoDe(l) === filtros.formaPagamento,
    )
    .sort((a, b) =>
      `${b.data} ${b.hora}`.localeCompare(`${a.data} ${a.hora}`),
    );

  const categorias = new Set<string>();
  const formas = new Set<string>();
  const anos = new Set<number>([ano]);
  for (const l of todos) {
    categorias.add(l.categoria);
    const forma = formaPagamentoDe(l);
    if (forma) formas.add(forma);
    const a = Number(l.data.slice(0, 4));
    if (a) anos.add(a);
  }

  return {
    resumo,
    taxaPoupanca:
      resumo.totalEntradas > 0
        ? (resumo.saldo / resumo.totalEntradas) * 100
        : null,
    categorias: montarCategorias(resumo.despesasPorCategoria),
    evolucao: montarEvolucao(todos, ano, mes),
    diario: montarDiario(doPeriodo, ano, mes),
    lancamentos: tabela,
    opcoes: {
      categorias: [...categorias].sort((a, b) => a.localeCompare(b, "pt-BR")),
      formasPagamento: [...formas].sort((a, b) => a.localeCompare(b, "pt-BR")),
      anos: [...anos].sort((a, b) => b - a),
    },
  };
}
