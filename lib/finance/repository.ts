import type {
  AtualizacaoLancamento,
  Despesa,
  Entrada,
  FiltroLancamentos,
  Lancamento,
  NovaDespesa,
  NovaEntrada,
  ResumoMensal,
} from "@/types/finance";

export class LancamentoNaoEncontradoError extends Error {
  constructor(id: string) {
    super(`Lançamento com id "${id}" não foi encontrado.`);
    this.name = "LancamentoNaoEncontradoError";
  }
}

/**
 * Porta de persistência financeira. O restante da aplicação deve depender
 * apenas desta interface — nunca da implementação concreta (Google Sheets,
 * Postgres, Supabase, etc.), para permitir trocar o armazenamento sem
 * reescrever as camadas superiores.
 */
export interface FinanceRepository {
  criarDespesa(input: NovaDespesa): Promise<Despesa>;
  criarEntrada(input: NovaEntrada): Promise<Entrada>;
  buscarLancamentoPorId(id: string): Promise<Lancamento | null>;
  listarLancamentos(filtro?: FiltroLancamentos): Promise<Lancamento[]>;
  atualizarLancamento(
    id: string,
    patch: AtualizacaoLancamento,
  ): Promise<Lancamento>;
  excluirLancamento(id: string): Promise<void>;
  listarLancamentosDoMes(ano: number, mes: number): Promise<Lancamento[]>;
  calcularResumoMensal(ano: number, mes: number): Promise<ResumoMensal>;
}
