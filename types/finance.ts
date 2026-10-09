export type TipoLancamento = "despesa" | "entrada";

interface LancamentoBase {
  id: string;
  data: string;
  hora: string;
  descricao: string;
  valor: number;
  categoria: string;
  observacao?: string;
  origem: string;
  telegramUserId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Despesa extends LancamentoBase {
  tipo: "despesa";
  formaPagamento: string;
}

export interface Entrada extends LancamentoBase {
  tipo: "entrada";
}

export type Lancamento = Despesa | Entrada;

export interface NovaDespesa {
  /** Opcional: permite ao chamador definir o ID (idempotência). */
  id?: string;
  data?: string;
  hora?: string;
  descricao: string;
  valor: number;
  categoria: string;
  formaPagamento: string;
  observacao?: string;
  origem: string;
  telegramUserId?: string;
}

export interface NovaEntrada {
  /** Opcional: permite ao chamador definir o ID (idempotência). */
  id?: string;
  data?: string;
  hora?: string;
  descricao: string;
  valor: number;
  categoria: string;
  observacao?: string;
  origem: string;
  telegramUserId?: string;
}

export type AtualizacaoLancamento = Partial<
  Omit<LancamentoBase, "id" | "createdAt" | "updatedAt"> & {
    formaPagamento: string;
  }
>;

export interface FiltroLancamentos {
  tipo?: TipoLancamento;
  categoria?: string;
  dataInicio?: string;
  dataFim?: string;
}

export interface ResumoMensal {
  ano: number;
  mes: number;
  totalDespesas: number;
  totalEntradas: number;
  saldo: number;
  quantidadeDespesas: number;
  quantidadeEntradas: number;
  despesasPorCategoria: Record<string, number>;
  entradasPorCategoria: Record<string, number>;
}
