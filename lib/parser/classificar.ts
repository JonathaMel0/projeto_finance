import type { TipoLancamento } from "@/types/finance";
import { normalizar } from "./texto";
import type { ParserConfig } from "./types";

interface Termo {
  termo: string;
  tipo: TipoLancamento;
  categoria: string;
  prioridade: number;
}

export type Classificacao =
  | { status: "ok"; tipo: TipoLancamento; categoria: string }
  | { status: "incerto" };

function escapar(texto: string): string {
  return texto.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function montarTermos(config: ParserConfig): Termo[] {
  const termos: Termo[] = [];
  for (const tipo of ["despesa", "entrada"] as const) {
    config[tipo].forEach((categoria, prioridade) => {
      for (const palavra of categoria.palavrasChave) {
        termos.push({
          termo: normalizar(palavra),
          tipo,
          categoria: categoria.nome,
          prioridade,
        });
      }
    });
  }
  // Expressões mais longas primeiro: "pagamento recebido" consome
  // "pagamento" antes que ele seja tomado como despesa.
  return termos.sort((a, b) => b.termo.length - a.termo.length);
}

/**
 * Descobre tipo e categoria a partir das palavras-chave. Se casarem termos
 * de entrada E de despesa, ou nenhum termo, o resultado é "incerto" — o
 * parser nunca chuta. Com `tipoForcado`, só considera termos desse tipo.
 */
export function classificar(
  textoNormalizado: string,
  config: ParserConfig,
  tipoForcado?: TipoLancamento,
): Classificacao {
  let restante = ` ${textoNormalizado} `;
  const melhorPorTipo = new Map<TipoLancamento, Termo>();

  for (const termo of montarTermos(config)) {
    if (tipoForcado && termo.tipo !== tipoForcado) continue;
    const regex = new RegExp(
      `(?<![a-z0-9])${escapar(termo.termo)}(?![a-z0-9])`,
      "g",
    );
    if (!regex.test(restante)) continue;
    restante = restante.replace(regex, (m) => " ".repeat(m.length));

    const atual = melhorPorTipo.get(termo.tipo);
    if (!atual || termo.prioridade < atual.prioridade) {
      melhorPorTipo.set(termo.tipo, termo);
    }
  }

  if (melhorPorTipo.size !== 1) return { status: "incerto" };
  const [escolhido] = melhorPorTipo.values();
  if (!escolhido) return { status: "incerto" };
  return { status: "ok", tipo: escolhido.tipo, categoria: escolhido.categoria };
}

/** Mapa "forma normalizada" -> "forma acentuada" das palavras do dicionário. */
export function montarMapaAcentos(config: ParserConfig): Map<string, string> {
  const mapa = new Map<string, string>();
  for (const tipo of ["despesa", "entrada"] as const) {
    for (const categoria of config[tipo]) {
      for (const palavra of categoria.palavrasChave) {
        for (const parte of palavra.toLowerCase().split(" ")) {
          const norm = normalizar(parte);
          if (norm !== parte) mapa.set(norm, parte);
        }
      }
    }
  }
  return mapa;
}
