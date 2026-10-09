import type { TipoLancamento } from "@/types/finance";
import { montarMapaAcentos } from "./classificar";
import { PARSER_CONFIG_PADRAO } from "./config";
import { extrairData } from "./data";
import { formatarDescricao, normalizar, tokenizar } from "./texto";
import type { ParserConfig } from "./types";
import { parseValorBR } from "./valor";

export type CampoEditavel = "descricao" | "valor" | "categoria" | "data";

export const ROTULO_CAMPO: Record<CampoEditavel, string> = {
  descricao: "Descrição",
  valor: "Valor",
  categoria: "Categoria",
  data: "Data",
};

const SINONIMOS: Record<string, CampoEditavel> = {
  descricao: "descricao",
  desc: "descricao",
  valor: "valor",
  categoria: "categoria",
  cat: "categoria",
  data: "data",
};

const TAMANHO_MAXIMO_DESCRICAO = 80;

/** "Descrição" / "valor" / "cat" -> campo editável; `null` se desconhecido. */
export function reconhecerCampo(texto: string): CampoEditavel | null {
  return SINONIMOS[normalizar(texto.trim())] ?? null;
}

export type ResultadoCampo =
  | { ok: true; valor: string | number }
  | { ok: false; erro: string };

export interface OpcoesCampo {
  tipo: TipoLancamento;
  /** "YYYY-MM-DD" no fuso de São Paulo. */
  hoje: string;
  config?: ParserConfig;
}

export function nomesDeCategoria(
  tipo: TipoLancamento,
  config: ParserConfig = PARSER_CONFIG_PADRAO,
): string[] {
  return config[tipo].map((c) => c.nome);
}

/**
 * Valida o novo valor de um campo digitado pelo usuário na edição
 * ("59,90", "lazer", "ontem", "padaria do bairro").
 */
export function interpretarCampo(
  campo: CampoEditavel,
  texto: string,
  { tipo, hoje, config = PARSER_CONFIG_PADRAO }: OpcoesCampo,
): ResultadoCampo {
  const limpo = texto.trim();

  switch (campo) {
    case "valor": {
      const valor = parseValorBR(limpo.replace(/^R\$\s*/i, ""));
      return valor === null
        ? { ok: false, erro: "Valor inválido. Envie algo como: 59,90" }
        : { ok: true, valor };
    }

    case "descricao": {
      if (!limpo) return { ok: false, erro: "A descrição não pode ficar vazia." };
      if (limpo.length > TAMANHO_MAXIMO_DESCRICAO) {
        return {
          ok: false,
          erro: `Descrição muito longa (máximo ${TAMANHO_MAXIMO_DESCRICAO} caracteres).`,
        };
      }
      return {
        ok: true,
        valor: formatarDescricao(limpo.split(/\s+/), montarMapaAcentos(config)),
      };
    }

    case "categoria": {
      const alvo = normalizar(limpo);
      const nomes = nomesDeCategoria(tipo, config);
      const nome = nomes.find((n) => normalizar(n) === alvo);
      return nome
        ? { ok: true, valor: nome }
        : {
            ok: false,
            erro: `Categoria desconhecida. Opções: ${nomes.join(", ")}.`,
          };
    }

    case "data": {
      const tokens = tokenizar(limpo);
      const resultado = extrairData(tokens, hoje);
      if (
        !resultado.ok ||
        !resultado.data ||
        tokens.length === 0 ||
        tokens.some((t) => !t.usado)
      ) {
        return {
          ok: false,
          erro: "Data inválida. Use hoje, ontem, dia 5, 05/09 ou 05/09/2026.",
        };
      }
      return { ok: true, valor: resultado.data };
    }
  }
}
