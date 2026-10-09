import type { SheetCellValue, SheetsDataSource } from "@/lib/google-sheets/client";

/**
 * Implementação em memória de `SheetsDataSource`, usada para testar o
 * `FinanceRepository` sem depender de credenciais reais do Google.
 */
export class FakeSheetsClient implements SheetsDataSource {
  private readonly tabelas = new Map<string, string[][]>();

  async readRows(sheetName: string): Promise<string[][]> {
    const linhas = this.tabelas.get(sheetName) ?? [];
    return linhas.map((linha) => [...linha]);
  }

  async appendRow(
    sheetName: string,
    row: readonly SheetCellValue[],
  ): Promise<void> {
    const linhas = this.tabelas.get(sheetName) ?? [];
    linhas.push(row.map(String));
    this.tabelas.set(sheetName, linhas);
  }

  async updateRow(
    sheetName: string,
    rowNumber: number,
    row: readonly SheetCellValue[],
  ): Promise<void> {
    const linhas = this.tabelas.get(sheetName) ?? [];
    const index = rowNumber - 2;
    if (index < 0 || index >= linhas.length) {
      throw new Error(`Linha ${rowNumber} não existe na aba "${sheetName}".`);
    }
    linhas[index] = row.map(String);
  }

  async deleteRow(sheetName: string, rowNumber: number): Promise<void> {
    const linhas = this.tabelas.get(sheetName) ?? [];
    const index = rowNumber - 2;
    if (index < 0 || index >= linhas.length) {
      throw new Error(`Linha ${rowNumber} não existe na aba "${sheetName}".`);
    }
    linhas.splice(index, 1);
  }

  /** Atalho de inspeção usado nos testes para conferir o estado bruto. */
  dump(sheetName: string): string[][] {
    return this.tabelas.get(sheetName) ?? [];
  }
}
