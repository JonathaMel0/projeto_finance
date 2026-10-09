import type { Despesa, Entrada } from "@/types/finance";
import type { SheetCellValue } from "./client";

function cell(value: string | undefined): string {
  return value ?? "";
}

function optional(value: string | undefined): string | undefined {
  return value ? value : undefined;
}

export function despesaToRow(d: Despesa): SheetCellValue[] {
  return [
    d.id,
    d.data,
    d.hora,
    d.descricao,
    d.valor,
    d.categoria,
    d.formaPagamento,
    cell(d.observacao),
    d.origem,
    cell(d.telegramUserId),
    d.createdAt,
    d.updatedAt,
  ];
}

export function rowToDespesa(row: string[]): Despesa {
  const [
    id,
    data,
    hora,
    descricao,
    valor,
    categoria,
    formaPagamento,
    observacao,
    origem,
    telegramUserId,
    createdAt,
    updatedAt,
  ] = row;

  return {
    tipo: "despesa",
    id: cell(id),
    data: cell(data),
    hora: cell(hora),
    descricao: cell(descricao),
    valor: Number(valor ?? 0),
    categoria: cell(categoria),
    formaPagamento: cell(formaPagamento),
    observacao: optional(observacao),
    origem: cell(origem),
    telegramUserId: optional(telegramUserId),
    createdAt: cell(createdAt),
    updatedAt: cell(updatedAt),
  };
}

export function entradaToRow(e: Entrada): SheetCellValue[] {
  return [
    e.id,
    e.data,
    e.hora,
    e.descricao,
    e.valor,
    e.categoria,
    cell(e.observacao),
    e.origem,
    cell(e.telegramUserId),
    e.createdAt,
    e.updatedAt,
  ];
}

export function rowToEntrada(row: string[]): Entrada {
  const [
    id,
    data,
    hora,
    descricao,
    valor,
    categoria,
    observacao,
    origem,
    telegramUserId,
    createdAt,
    updatedAt,
  ] = row;

  return {
    tipo: "entrada",
    id: cell(id),
    data: cell(data),
    hora: cell(hora),
    descricao: cell(descricao),
    valor: Number(valor ?? 0),
    categoria: cell(categoria),
    observacao: optional(observacao),
    origem: cell(origem),
    telegramUserId: optional(telegramUserId),
    createdAt: cell(createdAt),
    updatedAt: cell(updatedAt),
  };
}
