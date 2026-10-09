import { GoogleSheetsFinanceRepository } from "./google-sheets-repository";
import type { FinanceRepository } from "./repository";

let instance: FinanceRepository | null = null;

/**
 * Único ponto de acesso à persistência financeira usado pelo restante da
 * aplicação. Hoje devolve uma implementação baseada em Google Sheets; para
 * trocar de armazenamento no futuro (Postgres, Supabase, etc.), basta
 * alterar esta função — nenhum outro código deve importar
 * `GoogleSheetsFinanceRepository` diretamente.
 */
export function getFinanceRepository(): FinanceRepository {
  if (!instance) {
    instance = new GoogleSheetsFinanceRepository();
  }
  return instance;
}

export type { FinanceRepository } from "./repository";
export { LancamentoNaoEncontradoError } from "./repository";
export * from "@/types/finance";
