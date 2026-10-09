import type { ParserConfig } from "./types";

/**
 * Dicionário padrão. A ordem das categorias é a prioridade em caso de
 * conflito (ex.: "conta de luz" casa com Contas e Moradia; Moradia vem antes).
 * Futuramente pode ser carregado da aba `categorias` da planilha.
 */
export const PARSER_CONFIG_PADRAO: ParserConfig = {
  despesa: [
    {
      nome: "Moradia",
      palavrasChave: [
        "aluguel", "condomínio", "energia", "água", "luz", "internet", "gás",
      ],
    },
    {
      nome: "Saúde",
      palavrasChave: [
        "farmácia", "médico", "consulta", "exame", "dentista", "remédio",
        "hospital", "plano de saúde", "academia",
      ],
    },
    {
      nome: "Transporte",
      palavrasChave: [
        "uber", "99", "gasolina", "combustível", "estacionamento", "ônibus",
        "metrô", "pedágio", "táxi",
      ],
    },
    {
      nome: "Alimentação",
      palavrasChave: [
        "padaria", "restaurante", "almoço", "jantar", "comida", "ifood",
        "lanche", "mercado", "supermercado", "café", "pizza", "açougue",
        "hortifruti",
      ],
    },
    { nome: "Educação", palavrasChave: ["escola", "faculdade", "curso"] },
    {
      nome: "Lazer",
      palavrasChave: ["cinema", "jogo", "games", "viagem", "parque", "show", "bar"],
    },
    {
      nome: "Assinaturas",
      palavrasChave: ["assinatura", "netflix", "spotify", "youtube", "disney"],
    },
    {
      nome: "Impostos",
      palavrasChave: ["imposto", "iptu", "ipva", "irpf", "taxa", "multa"],
    },
    {
      nome: "Dívidas",
      palavrasChave: ["dívida", "financiamento", "empréstimo", "parcela"],
    },
    {
      nome: "Investimentos",
      palavrasChave: ["investimento", "aporte", "tesouro", "cdb", "fii", "ações"],
    },
    {
      nome: "Compras",
      palavrasChave: ["compra", "roupa", "tênis", "geladeira", "celular"],
    },
    { nome: "Contas", palavrasChave: ["conta", "fatura", "telefone"] },
    { nome: "Outros", palavrasChave: ["pagamento", "gasto", "despesa"] },
  ],
  entrada: [
    {
      nome: "Salário",
      palavrasChave: ["salário", "ordenado", "holerite"],
    },
    { nome: "Freelance", palavrasChave: ["freela", "freelance", "freelancer"] },
    {
      nome: "Rendimentos",
      palavrasChave: ["rendimento", "rendimentos", "dividendo", "dividendos", "juros"],
    },
    { nome: "Reembolso", palavrasChave: ["reembolso", "restituição"] },
    { nome: "Venda", palavrasChave: ["venda", "comissão"] },
    {
      nome: "Transferência",
      palavrasChave: ["pix recebido", "transferência recebida", "depósito"],
    },
    {
      nome: "Outros",
      palavrasChave: [
        "pagamento recebido", "recebido", "recebida", "recebimento", "renda",
      ],
    },
  ],
};
