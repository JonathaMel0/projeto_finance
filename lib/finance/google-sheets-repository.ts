import { randomUUID } from "node:crypto";
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
import {
  createGoogleSheetsClient,
  type SheetsDataSource,
} from "@/lib/google-sheets/client";
import {
  despesaToRow,
  entradaToRow,
  rowToDespesa,
  rowToEntrada,
} from "@/lib/google-sheets/mappers";
import { SHEET_NAMES } from "@/lib/google-sheets/schema";
import { formatDateSaoPaulo, formatTimeSaoPaulo, prefixoAnoMes } from "./datetime";
import { calcularResumoMensal } from "./resumo";
import { LancamentoNaoEncontradoError, type FinanceRepository } from "./repository";

interface LinhaEncontrada<T> {
  item: T;
  rowNumber: number;
}

export class GoogleSheetsFinanceRepository implements FinanceRepository {
  constructor(
    private readonly sheets: SheetsDataSource = createGoogleSheetsClient(),
  ) {}

  async criarDespesa(input: NovaDespesa): Promise<Despesa> {
    const now = new Date();
    const despesa: Despesa = {
      tipo: "despesa",
      id: input.id ?? randomUUID(),
      data: input.data ?? formatDateSaoPaulo(now),
      hora: input.hora ?? formatTimeSaoPaulo(now),
      descricao: input.descricao,
      valor: input.valor,
      categoria: input.categoria,
      formaPagamento: input.formaPagamento,
      observacao: input.observacao,
      origem: input.origem,
      telegramUserId: input.telegramUserId,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };
    await this.sheets.appendRow(SHEET_NAMES.despesas, despesaToRow(despesa));
    return despesa;
  }

  async criarEntrada(input: NovaEntrada): Promise<Entrada> {
    const now = new Date();
    const entrada: Entrada = {
      tipo: "entrada",
      id: input.id ?? randomUUID(),
      data: input.data ?? formatDateSaoPaulo(now),
      hora: input.hora ?? formatTimeSaoPaulo(now),
      descricao: input.descricao,
      valor: input.valor,
      categoria: input.categoria,
      observacao: input.observacao,
      origem: input.origem,
      telegramUserId: input.telegramUserId,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };
    await this.sheets.appendRow(SHEET_NAMES.entradas, entradaToRow(entrada));
    return entrada;
  }

  async buscarLancamentoPorId(id: string): Promise<Lancamento | null> {
    const despesa = await this.encontrarPorId(
      SHEET_NAMES.despesas,
      id,
      rowToDespesa,
    );
    if (despesa) return despesa.item;

    const entrada = await this.encontrarPorId(
      SHEET_NAMES.entradas,
      id,
      rowToEntrada,
    );
    return entrada?.item ?? null;
  }

  async listarLancamentos(filtro: FiltroLancamentos = {}): Promise<Lancamento[]> {
    let lancamentos = await this.listarTodos();
    const { tipo, categoria, dataInicio, dataFim } = filtro;

    if (tipo) {
      lancamentos = lancamentos.filter((l) => l.tipo === tipo);
    }
    if (categoria) {
      lancamentos = lancamentos.filter((l) => l.categoria === categoria);
    }
    if (dataInicio) {
      lancamentos = lancamentos.filter((l) => l.data >= dataInicio);
    }
    if (dataFim) {
      lancamentos = lancamentos.filter((l) => l.data <= dataFim);
    }

    return lancamentos.sort((a, b) =>
      `${a.data}${a.hora}`.localeCompare(`${b.data}${b.hora}`),
    );
  }

  async atualizarLancamento(
    id: string,
    patch: AtualizacaoLancamento,
  ): Promise<Lancamento> {
    const despesaEncontrada = await this.encontrarPorId(
      SHEET_NAMES.despesas,
      id,
      rowToDespesa,
    );
    if (despesaEncontrada) {
      const atualizada: Despesa = {
        ...despesaEncontrada.item,
        ...patch,
        tipo: "despesa",
        id,
        updatedAt: new Date().toISOString(),
      };
      await this.sheets.updateRow(
        SHEET_NAMES.despesas,
        despesaEncontrada.rowNumber,
        despesaToRow(atualizada),
      );
      return atualizada;
    }

    const entradaEncontrada = await this.encontrarPorId(
      SHEET_NAMES.entradas,
      id,
      rowToEntrada,
    );
    if (entradaEncontrada) {
      const atualizada: Entrada = {
        ...entradaEncontrada.item,
        ...patch,
        tipo: "entrada",
        id,
        updatedAt: new Date().toISOString(),
      };
      await this.sheets.updateRow(
        SHEET_NAMES.entradas,
        entradaEncontrada.rowNumber,
        entradaToRow(atualizada),
      );
      return atualizada;
    }

    throw new LancamentoNaoEncontradoError(id);
  }

  async excluirLancamento(id: string): Promise<void> {
    const despesaEncontrada = await this.encontrarPorId(
      SHEET_NAMES.despesas,
      id,
      rowToDespesa,
    );
    if (despesaEncontrada) {
      await this.sheets.deleteRow(SHEET_NAMES.despesas, despesaEncontrada.rowNumber);
      return;
    }

    const entradaEncontrada = await this.encontrarPorId(
      SHEET_NAMES.entradas,
      id,
      rowToEntrada,
    );
    if (entradaEncontrada) {
      await this.sheets.deleteRow(SHEET_NAMES.entradas, entradaEncontrada.rowNumber);
      return;
    }

    throw new LancamentoNaoEncontradoError(id);
  }

  async listarLancamentosDoMes(ano: number, mes: number): Promise<Lancamento[]> {
    const prefixo = prefixoAnoMes(ano, mes);
    const lancamentos = await this.listarTodos();
    return lancamentos.filter((l) => l.data.startsWith(prefixo));
  }

  async calcularResumoMensal(ano: number, mes: number): Promise<ResumoMensal> {
    const lancamentos = await this.listarLancamentosDoMes(ano, mes);
    return calcularResumoMensal(lancamentos, ano, mes);
  }

  private async listarTodos(): Promise<Lancamento[]> {
    const [despesas, entradas] = await Promise.all([
      this.sheets.readRows(SHEET_NAMES.despesas),
      this.sheets.readRows(SHEET_NAMES.entradas),
    ]);
    return [...despesas.map(rowToDespesa), ...entradas.map(rowToEntrada)];
  }

  private async encontrarPorId<T extends Lancamento>(
    sheetName: string,
    id: string,
    mapper: (row: string[]) => T,
  ): Promise<LinhaEncontrada<T> | null> {
    const rows = await this.sheets.readRows(sheetName);
    const index = rows.findIndex((row) => row[0] === id);
    if (index === -1) return null;
    return { item: mapper(rows[index]!), rowNumber: index + 2 };
  }
}
