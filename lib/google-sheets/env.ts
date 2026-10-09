export interface GoogleSheetsEnv {
  spreadsheetId: string;
  clientEmail: string;
  privateKey: string;
}

export function getGoogleSheetsEnv(): GoogleSheetsEnv {
  const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKeyRaw = process.env.GOOGLE_PRIVATE_KEY;

  const missing = [
    !spreadsheetId && "GOOGLE_SHEETS_SPREADSHEET_ID",
    !clientEmail && "GOOGLE_SERVICE_ACCOUNT_EMAIL",
    !privateKeyRaw && "GOOGLE_PRIVATE_KEY",
  ].filter(Boolean);

  if (missing.length > 0) {
    throw new Error(
      `Variáveis de ambiente do Google Sheets ausentes: ${missing.join(", ")}. Veja .env.example.`,
    );
  }

  return {
    spreadsheetId: spreadsheetId!,
    clientEmail: clientEmail!,
    // Em arquivos .env o caractere de quebra de linha da chave privada é
    // normalmente escapado como "\\n" e precisa ser restaurado.
    privateKey: privateKeyRaw!.replace(/\\n/g, "\n"),
  };
}
