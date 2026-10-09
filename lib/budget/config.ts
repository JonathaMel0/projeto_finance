import type { SheetsDataSource } from "@/lib/google-sheets/client";
import { SHEET_NAMES } from "@/lib/google-sheets/schema";

export type Grupo = "necessidade" | "desejo" | "objetivo";

export const GRUPOS: Grupo[] = ["necessidade", "desejo", "objetivo"];

export const ROTULO_GRUPO: Record<Grupo, string> = {
  necessidade: "Necessidades",
  desejo: "Desejos",
  objetivo: "Objetivos",
};

export interface ConfigOrcamento {
  /** Percentuais da renda por grupo; somam 100. */
  percentuais: Record<Grupo, number>;
  /** Classificação por categoria (chave normalizada, ver `normalizar`). */
  classificacao: Record<string, Grupo>;
  /** Grupo das categorias que não aparecem em `classificacao`. */
  grupoPadrao: Grupo;
}

export const CONFIG_ORCAMENTO_PADRAO: ConfigOrcamento = {
  percentuais: { necessidade: 50, desejo: 30, objetivo: 20 },
  grupoPadrao: "desejo",
  classificacao: {
    moradia: "necessidade",
    saude: "necessidade",
    transporte: "necessidade",
    alimentacao: "necessidade",
    educacao: "necessidade",
    impostos: "necessidade",
    dividas: "necessidade",
    contas: "necessidade",
    lazer: "desejo",
    assinaturas: "desejo",
    compras: "desejo",
    outros: "desejo",
    investimentos: "objetivo",
    poupanca: "objetivo",
  },
};

const CHAVES_PERCENTUAL: Record<Grupo, string> = {
  necessidade: "orcamento_necessidades",
  desejo: "orcamento_desejos",
  objetivo: "orcamento_objetivos",
};

const PREFIXO_CLASSIFICACAO = "classificacao_";

/** Minúsculas e sem acento, para comparar categorias ("Saúde" = "saude"). */
export function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

export function grupoDaCategoria(
  categoria: string,
  config: ConfigOrcamento,
): Grupo {
  return config.classificacao[normalizar(categoria)] ?? config.grupoPadrao;
}

function lerNumero(valor: string): number | null {
  let limpo = valor.replace(/R\$|%|\s/g, "");
  // Formato brasileiro (1.234,56): o ponto é separador de milhar.
  if (limpo.includes(",")) limpo = limpo.replace(/\./g, "").replace(",", ".");
  if (limpo === "") return null;
  const n = Number(limpo);
  return Number.isFinite(n) ? n : null;
}

function lerGrupo(valor: string): Grupo | null {
  const v = normalizar(valor);
  if (v.startsWith("necessidade")) return "necessidade";
  if (v.startsWith("desejo")) return "desejo";
  if (v.startsWith("objetivo")) return "objetivo";
  return null;
}

/**
 * Monta a configuração a partir das linhas (chave, valor) da aba
 * `configuracoes`. Valores ausentes usam o padrão; valores inválidos também,
 * e cada problema vira um aviso para aparecer no dashboard.
 * `saldo_inicial` é o saldo da conta antes do primeiro lançamento.
 */
export function lerConfigOrcamento(linhas: string[][]): {
  config: ConfigOrcamento;
  avisos: string[];
  saldoInicial: number;
} {
  const avisos: string[] = [];
  const mapa = new Map<string, string>();
  for (const [chave = "", valor = ""] of linhas) {
    if (chave.trim()) mapa.set(normalizar(chave), valor.trim());
  }

  let saldoInicial = 0;
  const brutoSaldo = mapa.get("saldo_inicial");
  if (brutoSaldo) {
    const n = lerNumero(brutoSaldo);
    if (n === null) avisos.push(`Valor inválido em "saldo_inicial": "${brutoSaldo}".`);
    else saldoInicial = n;
  }

  const percentuais = { ...CONFIG_ORCAMENTO_PADRAO.percentuais };
  const informados: Partial<Record<Grupo, number>> = {};
  for (const grupo of GRUPOS) {
    const bruto = mapa.get(CHAVES_PERCENTUAL[grupo]);
    if (bruto === undefined) continue;
    const n = lerNumero(bruto);
    if (n === null || n < 0) {
      avisos.push(`Valor inválido em "${CHAVES_PERCENTUAL[grupo]}": "${bruto}".`);
    } else {
      informados[grupo] = n;
    }
  }

  const valores = Object.values(informados);
  if (valores.length > 0) {
    // Células formatadas como % chegam como fração (0,5 = 50%).
    const emFracao = valores.every((v) => v <= 1) && valores.length === 3;
    for (const grupo of GRUPOS) {
      const v = informados[grupo];
      if (v !== undefined) percentuais[grupo] = emFracao ? v * 100 : v;
    }
    const soma = GRUPOS.reduce((t, g) => t + percentuais[g], 0);
    if (Math.abs(soma - 100) > 0.01) {
      avisos.push(
        `Os percentuais do orçamento somam ${soma.toFixed(1)}% (deveriam somar 100%). Usando 50/30/20.`,
      );
      Object.assign(percentuais, CONFIG_ORCAMENTO_PADRAO.percentuais);
    }
  }

  const classificacao = { ...CONFIG_ORCAMENTO_PADRAO.classificacao };
  for (const [chave, valor] of mapa) {
    if (!chave.startsWith(PREFIXO_CLASSIFICACAO)) continue;
    const categoria = chave.slice(PREFIXO_CLASSIFICACAO.length);
    const grupo = lerGrupo(valor);
    if (!categoria || !grupo) {
      avisos.push(`Classificação inválida em "${chave}": "${valor}".`);
    } else {
      classificacao[categoria] = grupo;
    }
  }

  return {
    config: { ...CONFIG_ORCAMENTO_PADRAO, percentuais, classificacao },
    avisos,
    saldoInicial,
  };
}

/** Lê a aba `configuracoes`; se falhar, o dashboard segue com o padrão 50/30/20. */
export async function carregarConfigOrcamento(sheets: SheetsDataSource) {
  try {
    return lerConfigOrcamento(await sheets.readRows(SHEET_NAMES.configuracoes));
  } catch (erro) {
    console.error("Falha ao ler a aba configuracoes", erro);
    return {
      config: CONFIG_ORCAMENTO_PADRAO,
      avisos: [
        "Não foi possível ler a aba configuracoes; usando o padrão 50/30/20.",
      ],
      saldoInicial: 0,
    };
  }
}
