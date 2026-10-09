import type { SheetsDataSource } from "@/lib/google-sheets/client";
import { SHEET_NAMES } from "@/lib/google-sheets/schema";
import type {
  CampoEditavel,
  LancamentoParseado,
  RascunhoLancamento,
} from "@/lib/parser";

/** Lançamentos pendentes expiram depois deste tempo sem resposta. */
export const VALIDADE_PENDENTE_MS = 24 * 60 * 60 * 1000;

/** Edição de um campo à espera do novo valor digitado pelo usuário. */
export interface EdicaoAberta {
  kind: "edicao";
  /** O que está sendo editado: um lançamento já gravado ou um pendente. */
  alvo: { tipo: "lancamento" | "pendente"; id: string };
  campo: CampoEditavel;
  /** Mensagem do bot a ser atualizada quando a edição terminar. */
  messageId: number;
}

export type ConteudoPendente =
  | { kind: "lancamento"; lancamento: LancamentoParseado }
  | { kind: "tipo"; rascunho: RascunhoLancamento }
  | EdicaoAberta;

/** Edições abertas expiram rápido, para não capturar mensagens muito depois. */
export const VALIDADE_EDICAO_MS = 10 * 60 * 1000;

export interface Pendente {
  id: string;
  chatId: number;
  userId: number;
  criadoEm: string;
  conteudo: ConteudoPendente;
}

/**
 * Guarda lançamentos entre a mensagem do usuário e o clique no botão. Em
 * ambiente serverless não dá para confiar na memória do processo, por isso
 * o estado fica na própria planilha (aba `pendentes`).
 */
export interface PendingStore {
  salvar(pendente: Pendente): Promise<void>;
  buscar(id: string): Promise<Pendente | null>;
  /** Edição mais recente aguardando texto desse usuário nesse chat. */
  buscarEdicaoAberta(chatId: number, userId: number): Promise<Pendente | null>;
  atualizar(pendente: Pendente): Promise<void>;
  remover(id: string): Promise<void>;
}

type DadosSerializados = Omit<Pendente, "id">;

export class SheetsPendingStore implements PendingStore {
  constructor(private readonly sheets: SheetsDataSource) {}

  async salvar(pendente: Pendente): Promise<void> {
    await this.sheets.appendRow(SHEET_NAMES.pendentes, linha(pendente));
  }

  async buscar(id: string): Promise<Pendente | null> {
    const rows = await this.sheets.readRows(SHEET_NAMES.pendentes);
    const row = rows.find((r) => r[0] === id);
    if (!row) return null;
    try {
      const dados = JSON.parse(row[1] ?? "") as DadosSerializados;
      return { id, ...dados };
    } catch {
      return null;
    }
  }

  async buscarEdicaoAberta(
    chatId: number,
    userId: number,
  ): Promise<Pendente | null> {
    const rows = await this.sheets.readRows(SHEET_NAMES.pendentes);
    let maisRecente: Pendente | null = null;
    for (const row of rows) {
      try {
        const dados = JSON.parse(row[1] ?? "") as DadosSerializados;
        if (
          dados.conteudo.kind !== "edicao" ||
          dados.chatId !== chatId ||
          dados.userId !== userId
        ) {
          continue;
        }
        if (!maisRecente || dados.criadoEm > maisRecente.criadoEm) {
          maisRecente = { id: row[0] ?? "", ...dados };
        }
      } catch {
        // linha corrompida: ignora
      }
    }
    return maisRecente;
  }

  async atualizar(pendente: Pendente): Promise<void> {
    const rows = await this.sheets.readRows(SHEET_NAMES.pendentes);
    const index = rows.findIndex((r) => r[0] === pendente.id);
    if (index === -1) {
      await this.salvar(pendente);
      return;
    }
    await this.sheets.updateRow(SHEET_NAMES.pendentes, index + 2, linha(pendente));
  }

  async remover(id: string): Promise<void> {
    const rows = await this.sheets.readRows(SHEET_NAMES.pendentes);
    const index = rows.findIndex((r) => r[0] === id);
    if (index === -1) return;
    await this.sheets.deleteRow(SHEET_NAMES.pendentes, index + 2);
  }
}

function linha(pendente: Pendente): [string, string] {
  const { id, ...dados } = pendente;
  return [id, JSON.stringify(dados satisfies DadosSerializados)];
}
