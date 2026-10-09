import type { TipoLancamento } from "@/types/finance";
import { formatDateSaoPaulo } from "@/lib/finance/datetime";
import { classificar, montarMapaAcentos } from "./classificar";
import { PARSER_CONFIG_PADRAO } from "./config";
import { extrairData } from "./data";
import { detectarPagamento } from "./pagamento";
import { formatarDescricao, normalizar, tokenizar } from "./texto";
import {
  FORMA_NAO_INFORMADA,
  type LancamentoParseado,
  type OpcoesParse,
  type ParserConfig,
  type RascunhoLancamento,
  type ResultadoParse,
} from "./types";
import { extrairValor } from "./valor";

const TAMANHO_MAXIMO = 200;
const INICIO_DE_CONSULTA = new Set([
  "quanto", "quantos", "quantas", "quais", "qual", "listar", "mostrar",
]);

export { PARSER_CONFIG_PADRAO } from "./config";
export { parseValorBR } from "./valor";
export {
  interpretarCampo,
  nomesDeCategoria,
  reconhecerCampo,
  ROTULO_CAMPO,
  type CampoEditavel,
  type ResultadoCampo,
} from "./campos";
export * from "./types";

/**
 * Interpreta mensagens como "padaria 54,90", "salario valid 10900" ou
 * "almoço 35 ontem". Determinístico: sem valor + descrição confiáveis não
 * há lançamento, e tipo ambíguo é devolvido como `tipo_incerto`.
 */
export function parseMensagem(
  texto: string,
  opcoes: OpcoesParse = {},
): ResultadoParse {
  const config = opcoes.config ?? PARSER_CONFIG_PADRAO;
  const hoje = opcoes.hoje ?? formatDateSaoPaulo(new Date());

  if (texto.length > TAMANHO_MAXIMO) {
    return { status: "invalido", motivo: "muito_longo" };
  }
  const tokens = tokenizar(texto);
  const primeiro = tokens[0];
  if (!primeiro) return { status: "invalido", motivo: "vazio" };
  if (INICIO_DE_CONSULTA.has(primeiro.norm)) {
    return { status: "invalido", motivo: "consulta" };
  }

  const data = extrairData(tokens, hoje);
  if (!data.ok) return { status: "invalido", motivo: data.motivo };

  const valor = extrairValor(tokens);
  if (!valor.ok) return { status: "invalido", motivo: valor.motivo };

  const pagamento = detectarPagamento(tokens);
  const livres = tokens
    .map((token, indice) => ({ token, indice }))
    .filter(({ token }) => !token.usado);

  if (livres.length === 0) return { status: "invalido", motivo: "sem_descricao" };

  const acentos = montarMapaAcentos(config);
  const descricaoCompleta = formatarDescricao(
    livres.map(({ token }) => token.texto),
    acentos,
  );
  const semPagamento = livres.filter(
    ({ indice }) => !pagamento.indices.includes(indice),
  );
  const descricaoSemPagamento = semPagamento.length
    ? formatarDescricao(
        semPagamento.map(({ token }) => token.texto),
        acentos,
      )
    : descricaoCompleta;

  const rascunho: RascunhoLancamento = {
    valor: valor.valor,
    data: data.data,
    formaPagamento: pagamento.forma,
    descricaoCompleta,
    descricaoSemPagamento,
  };

  const classificacao = classificar(
    normalizar(livres.map(({ token }) => token.texto).join(" ")),
    config,
  );
  if (classificacao.status === "incerto") {
    return { status: "tipo_incerto", rascunho };
  }
  return {
    status: "ok",
    lancamento: montarLancamento(
      rascunho,
      classificacao.tipo,
      classificacao.categoria,
    ),
  };
}

/**
 * Conclui um rascunho depois que o usuário escolheu o tipo no Telegram
 * ("1 - Entrada / 2 - Despesa"). A categoria vem das palavras-chave do tipo
 * escolhido, ou "Outros" se nada casar.
 */
export function completarRascunho(
  rascunho: RascunhoLancamento,
  tipo: TipoLancamento,
  config: ParserConfig = PARSER_CONFIG_PADRAO,
): LancamentoParseado {
  const classificacao = classificar(
    normalizar(rascunho.descricaoCompleta),
    config,
    tipo,
  );
  const categoria = classificacao.status === "ok" ? classificacao.categoria : "Outros";
  return montarLancamento(rascunho, tipo, categoria);
}

function montarLancamento(
  rascunho: RascunhoLancamento,
  tipo: TipoLancamento,
  categoria: string,
): LancamentoParseado {
  const base = {
    tipo,
    valor: rascunho.valor,
    categoria,
    data: rascunho.data,
  };
  return tipo === "despesa"
    ? {
        ...base,
        descricao: rascunho.descricaoSemPagamento,
        formaPagamento: rascunho.formaPagamento || FORMA_NAO_INFORMADA,
      }
    : { ...base, descricao: rascunho.descricaoCompleta };
}
