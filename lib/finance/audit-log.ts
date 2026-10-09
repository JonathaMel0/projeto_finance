import { randomUUID } from "node:crypto";
import type { SheetsDataSource } from "@/lib/google-sheets/client";
import { SHEET_NAMES } from "@/lib/google-sheets/schema";

export type OperacaoAuditada = "criacao" | "edicao" | "exclusao" | "erro";

export interface EntradaAuditoria {
  operacao: OperacaoAuditada;
  nivel?: "info" | "erro";
  detalhes: Record<string, unknown>;
}

/**
 * Trilha de auditoria das operações importantes. O registro é um extra:
 * implementações nunca devem lançar, para que uma falha no log não desfaça
 * uma operação que já foi concluída.
 */
export interface AuditLog {
  registrar(entrada: EntradaAuditoria): Promise<void>;
}

/** Grava na aba `logs`: id | data_hora | nivel | operacao | detalhes (JSON). */
export class SheetsAuditLog implements AuditLog {
  constructor(
    private readonly sheets: SheetsDataSource,
    private readonly agora: () => Date = () => new Date(),
  ) {}

  async registrar(entrada: EntradaAuditoria): Promise<void> {
    try {
      await this.sheets.appendRow(SHEET_NAMES.logs, [
        randomUUID(),
        this.agora().toISOString(),
        entrada.nivel ?? "info",
        entrada.operacao,
        JSON.stringify(entrada.detalhes),
      ]);
    } catch (error) {
      console.error("[audit] falha ao gravar log", error);
    }
  }
}
