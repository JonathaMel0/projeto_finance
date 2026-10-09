import type { TipoLancamento } from "@/types/finance";

export const FORMA_NAO_INFORMADA = "não informado";

export interface CategoriaConfig {
  nome: string;
  palavrasChave: string[];
}

/**
 * Dicionário do parser. A ORDEM das categorias define a prioridade: quando
 * uma mensagem casa com palavras de várias categorias, vence a que aparece
 * primeiro na lista.
 */
export interface ParserConfig {
  despesa: CategoriaConfig[];
  entrada: CategoriaConfig[];
}

export type MotivoInvalido =
  | "vazio"
  | "muito_longo"
  | "consulta"
  | "sem_valor"
  | "varios_valores"
  | "sem_descricao"
  | "data_invalida"
  | "varias_datas";

export interface LancamentoParseado {
  tipo: TipoLancamento;
  descricao: string;
  valor: number;
  categoria: string;
  /** "YYYY-MM-DD"; ausente significa "data atual" (decidido pelo repositório). */
  data?: string;
  /** Somente para despesas. */
  formaPagamento?: string;
}

/**
 * Mensagem com valor e descrição válidos, mas cujo tipo (entrada/despesa)
 * não pôde ser definido com segurança. O bot deve perguntar ao usuário e
 * então chamar `completarRascunho`.
 */
export interface RascunhoLancamento {
  valor: number;
  data?: string;
  formaPagamento: string;
  /** Descrição completa (mantém palavras de forma de pagamento). */
  descricaoCompleta: string;
  /** Descrição sem as palavras de forma de pagamento (usada em despesas). */
  descricaoSemPagamento: string;
}

export type ResultadoParse =
  | { status: "ok"; lancamento: LancamentoParseado }
  | { status: "tipo_incerto"; rascunho: RascunhoLancamento }
  | { status: "invalido"; motivo: MotivoInvalido };

export interface OpcoesParse {
  /** Data de hoje ("YYYY-MM-DD", fuso de São Paulo). Padrão: agora. */
  hoje?: string;
  config?: ParserConfig;
}
