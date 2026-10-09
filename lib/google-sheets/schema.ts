export const SHEET_NAMES = {
  despesas: "despesas",
  entradas: "entradas",
  categorias: "categorias",
  configuracoes: "configuracoes",
  usuarios: "usuarios",
  logs: "logs",
  pendentes: "pendentes",
} as const;

export const DESPESAS_COLUMNS = [
  "id",
  "data",
  "hora",
  "descricao",
  "valor",
  "categoria",
  "forma_pagamento",
  "observacao",
  "origem",
  "telegram_user_id",
  "created_at",
  "updated_at",
] as const;

export const ENTRADAS_COLUMNS = [
  "id",
  "data",
  "hora",
  "descricao",
  "valor",
  "categoria",
  "observacao",
  "origem",
  "telegram_user_id",
  "created_at",
  "updated_at",
] as const;

export const CATEGORIAS_COLUMNS = [
  "tipo",
  "categoria",
  "palavras_chave",
  "ativa",
] as const;

// Reservadas para etapas futuras (configurações e usuários autorizados).
export const CONFIGURACOES_COLUMNS = ["chave", "valor"] as const;

export const USUARIOS_COLUMNS = [
  "telegram_user_id",
  "nome",
  "ativo",
  "created_at",
] as const;

/**
 * Lançamentos aguardando confirmação no Telegram. `dados` é um JSON com
 * chat, usuário, data de criação e o conteúdo do lançamento.
 */
export const PENDENTES_COLUMNS = ["id", "dados"] as const;

export const LOGS_COLUMNS = [
  "id",
  "data_hora",
  "nivel",
  "operacao",
  "detalhes",
] as const;
