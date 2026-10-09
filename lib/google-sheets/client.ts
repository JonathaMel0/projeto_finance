import { google } from "googleapis";
import { getGoogleSheetsEnv } from "./env";

export type SheetCellValue = string | number;

/**
 * Porta de acesso a uma planilha, independente da biblioteca usada por
 * baixo. Permite substituir a implementação real por um fake em testes.
 */
export interface SheetsDataSource {
  /** Lê todas as linhas de dados da aba, sem incluir o cabeçalho. */
  readRows(sheetName: string): Promise<string[][]>;
  /** Insere uma nova linha ao final da aba. */
  appendRow(sheetName: string, row: readonly SheetCellValue[]): Promise<void>;
  /**
   * Sobrescreve uma linha existente.
   * `rowNumber` é a linha absoluta na planilha (cabeçalho = 1, primeira
   * linha de dados = 2) — é um detalhe interno, nunca o identificador da
   * entidade.
   */
  updateRow(
    sheetName: string,
    rowNumber: number,
    row: readonly SheetCellValue[],
  ): Promise<void>;
  /** Remove uma linha existente, deslocando as linhas abaixo para cima. */
  deleteRow(sheetName: string, rowNumber: number): Promise<void>;
}

export function createGoogleSheetsClient(): SheetsDataSource {
  const sheetIdCache = new Map<string, number>();

  function getClient() {
    const env = getGoogleSheetsEnv();
    const auth = new google.auth.JWT({
      email: env.clientEmail,
      key: env.privateKey,
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });
    return { sheets: google.sheets({ version: "v4", auth }), env };
  }

  async function getSheetId(sheetName: string): Promise<number> {
    const cached = sheetIdCache.get(sheetName);
    if (cached !== undefined) return cached;

    const { sheets, env } = getClient();
    const response = await sheets.spreadsheets.get({
      spreadsheetId: env.spreadsheetId,
    });
    const sheet = response.data.sheets?.find(
      (s) => s.properties?.title === sheetName,
    );
    const sheetId = sheet?.properties?.sheetId;
    if (sheetId === undefined || sheetId === null) {
      throw new Error(`Aba "${sheetName}" não encontrada na planilha.`);
    }

    sheetIdCache.set(sheetName, sheetId);
    return sheetId;
  }

  return {
    async readRows(sheetName) {
      const { sheets, env } = getClient();
      // UNFORMATTED_VALUE evita que o formato/locale da planilha altere os
      // dados lidos (ex.: "54,9" em vez de 54.9, ou datas reformatadas).
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: env.spreadsheetId,
        range: `${sheetName}!A2:Z`,
        valueRenderOption: "UNFORMATTED_VALUE",
      });
      return (response.data.values ?? []).map((row: unknown[]) =>
        row.map((cell) => (cell === null || cell === undefined ? "" : String(cell))),
      );
    },

    async appendRow(sheetName, row) {
      const { sheets, env } = getClient();
      await sheets.spreadsheets.values.append({
        spreadsheetId: env.spreadsheetId,
        range: `${sheetName}!A:A`,
        // RAW grava exatamente o que enviamos: datas e IDs continuam texto.
        valueInputOption: "RAW",
        insertDataOption: "INSERT_ROWS",
        requestBody: { values: [[...row]] },
      });
    },

    async updateRow(sheetName, rowNumber, row) {
      const { sheets, env } = getClient();
      await sheets.spreadsheets.values.update({
        spreadsheetId: env.spreadsheetId,
        range: `${sheetName}!A${rowNumber}:Z${rowNumber}`,
        valueInputOption: "RAW",
        requestBody: { values: [[...row]] },
      });
    },

    async deleteRow(sheetName, rowNumber) {
      const { sheets, env } = getClient();
      const sheetId = await getSheetId(sheetName);
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: env.spreadsheetId,
        requestBody: {
          requests: [
            {
              deleteDimension: {
                range: {
                  sheetId,
                  dimension: "ROWS",
                  startIndex: rowNumber - 1,
                  endIndex: rowNumber,
                },
              },
            },
          ],
        },
      });
    },
  };
}
