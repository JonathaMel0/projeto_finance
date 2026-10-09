import { afterEach, describe, expect, it, vi } from "vitest";
import { getGoogleSheetsEnv } from "@/lib/google-sheets/env";

describe("getGoogleSheetsEnv", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("restaura as quebras de linha escapadas da chave privada", () => {
    vi.stubEnv("GOOGLE_SHEETS_SPREADSHEET_ID", "planilha");
    vi.stubEnv("GOOGLE_SERVICE_ACCOUNT_EMAIL", "bot@projeto.iam.gserviceaccount.com");
    vi.stubEnv("GOOGLE_PRIVATE_KEY", "-----BEGIN-----\\nabc\\n-----END-----\\n");

    expect(getGoogleSheetsEnv()).toEqual({
      spreadsheetId: "planilha",
      clientEmail: "bot@projeto.iam.gserviceaccount.com",
      privateKey: "-----BEGIN-----\nabc\n-----END-----\n",
    });
  });

  it("lista as variáveis ausentes sem expor valores", () => {
    vi.stubEnv("GOOGLE_SHEETS_SPREADSHEET_ID", "");
    vi.stubEnv("GOOGLE_SERVICE_ACCOUNT_EMAIL", "");
    vi.stubEnv("GOOGLE_PRIVATE_KEY", "segredo");

    expect(() => getGoogleSheetsEnv()).toThrow(
      /GOOGLE_SHEETS_SPREADSHEET_ID, GOOGLE_SERVICE_ACCOUNT_EMAIL/,
    );
    expect(() => getGoogleSheetsEnv()).not.toThrow(/segredo/);
  });
});
