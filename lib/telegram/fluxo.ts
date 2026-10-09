import { randomUUID } from "node:crypto";
import {
  formatDateSaoPaulo,
  formatTimeSaoPaulo,
  getAnoMesAtual,
} from "@/lib/finance/datetime";
import type { FinanceRepository } from "@/lib/finance/repository";
import {
  completarRascunho,
  FORMA_NAO_INFORMADA,
  parseMensagem,
  type LancamentoParseado,
  type MotivoInvalido,
  type ParserConfig,
  type RascunhoLancamento,
} from "@/lib/parser";
import type { TelegramClient } from "./client";
import { formatarData, formatarMoeda } from "./formatacao";
import {
  VALIDADE_PENDENTE_MS,
  type PendingStore,
  type Pendente,
} from "./pending-store";
import type {
  InlineKeyboardButton,
  TelegramCallbackQuery,
  TelegramMessage,
} from "./types";

export const MSG_EXPIRADO = "Este lançamento expirou ou já foi processado.";
export const MSG_JA_REGISTRADO = "Este lançamento já foi registrado.";
export const MSG_CANCELADO = "Lançamento cancelado.";

/** Dicas mostradas apenas no chat privado; em grupos o bot fica quieto. */
const DICAS: Record<MotivoInvalido, string | null> = {
  vazio: null,
  muito_longo: "Mensagem muito longa. Envie algo como: padaria 54,90",
  consulta: "Consultas ainda não estão disponíveis. Em breve!",
  sem_valor: "Não encontrei um valor. Envie algo como: padaria 54,90",
  sem_descricao: "Faltou a descrição. Envie algo como: padaria 54,90",
  varios_valores:
    "Encontrei mais de um valor na mensagem. Envie só um, por exemplo: padaria 54,90",
  data_invalida:
    "Data inválida. Use hoje, ontem, dia 5, 05/09 ou 05/09/2026.",
  varias_datas: "Informe apenas uma data na mensagem.",
};

type Acao = "ok" | "no" | "e" | "d";

function parseCallbackData(
  data: string | undefined,
): { acao: Acao; id: string } | null {
  const m = /^(ok|no|e|d):(.+)$/.exec(data ?? "");
  if (!m) return null;
  return { acao: m[1] as Acao, id: m[2] as string };
}

function tecladoConfirmacao(id: string): InlineKeyboardButton[][] {
  return [
    [
      { text: "✅ Confirmar", callback_data: `ok:${id}` },
      { text: "❌ Cancelar", callback_data: `no:${id}` },
    ],
  ];
}

function tecladoTipo(id: string): InlineKeyboardButton[][] {
  return [
    [
      { text: "📥 Entrada", callback_data: `e:${id}` },
      { text: "📤 Despesa", callback_data: `d:${id}` },
    ],
    [{ text: "❌ Cancelar", callback_data: `no:${id}` }],
  ];
}

function textoConfirmacao(l: LancamentoParseado, hoje: string): string {
  const linhas = [
    "Lançamento identificado:",
    "",
    `Tipo: ${l.tipo === "despesa" ? "Despesa" : "Entrada"}`,
    `Descrição: ${l.descricao}`,
    `Valor: ${formatarMoeda(l.valor)}`,
    `Categoria: ${l.categoria}`,
  ];
  if (l.tipo === "despesa" && l.formaPagamento !== FORMA_NAO_INFORMADA) {
    linhas.push(`Pagamento: ${l.formaPagamento}`);
  }
  linhas.push(`Data: ${formatarData(l.data ?? hoje)}`, "", "Confirmar?");
  return linhas.join("\n");
}

function textoPerguntaTipo(r: RascunhoLancamento, hoje: string): string {
  return [
    "Não consegui identificar se isso é uma entrada ou despesa.",
    "",
    `Descrição: ${r.descricaoCompleta}`,
    `Valor: ${formatarMoeda(r.valor)}`,
    `Data: ${formatarData(r.data ?? hoje)}`,
    "",
    "O que é?",
  ].join("\n");
}

function dataDoPendente(pendente: Pendente): string {
  return formatDateSaoPaulo(new Date(pendente.criadoEm));
}

function soma(valores: number[]): number {
  return Math.round(valores.reduce((a, b) => a + b, 0) * 100) / 100;
}

export interface FluxoDeps {
  client: TelegramClient;
  repo: FinanceRepository;
  store: PendingStore;
  config?: ParserConfig;
  /** Injetáveis para testes. */
  agora?: () => Date;
  novoId?: () => string;
}

/**
 * Fluxo de lançamento: mensagem -> interpretação -> confirmação por botões
 * -> gravação. Nada é gravado antes do clique em "Confirmar", e a gravação
 * usa o ID do pendente, então cliques repetidos nunca duplicam o lançamento.
 */
export function criarFluxo(deps: FluxoDeps) {
  const { client, repo, store } = deps;
  const agora = deps.agora ?? (() => new Date());
  const novoId = deps.novoId ?? randomUUID;

  async function onText(message: TelegramMessage): Promise<void> {
    const userId = message.from?.id;
    if (userId === undefined) return;

    const chatId = message.chat.id;
    const privado = message.chat.type === "private";
    const hoje = formatDateSaoPaulo(agora());
    const opcoesEnvio = privado ? {} : { replyToMessageId: message.message_id };

    const resultado = parseMensagem(message.text ?? "", {
      hoje,
      config: deps.config,
    });

    if (resultado.status === "invalido") {
      const dica = DICAS[resultado.motivo];
      if (privado && dica) await client.sendMessage(chatId, dica);
      return;
    }

    const id = novoId();
    const base = { id, chatId, userId, criadoEm: agora().toISOString() };

    if (resultado.status === "tipo_incerto") {
      await store.salvar({
        ...base,
        conteudo: { kind: "tipo", rascunho: resultado.rascunho },
      });
      await client.sendMessage(
        chatId,
        textoPerguntaTipo(resultado.rascunho, hoje),
        { ...opcoesEnvio, inlineKeyboard: tecladoTipo(id) },
      );
      return;
    }

    await store.salvar({
      ...base,
      conteudo: { kind: "lancamento", lancamento: resultado.lancamento },
    });
    await client.sendMessage(
      chatId,
      textoConfirmacao(resultado.lancamento, hoje),
      { ...opcoesEnvio, inlineKeyboard: tecladoConfirmacao(id) },
    );
  }

  async function onCallback(callback: TelegramCallbackQuery): Promise<void> {
    await client.answerCallbackQuery(callback.id);

    const alvo = parseCallbackData(callback.data);
    const mensagem = callback.message;
    if (!alvo || !mensagem) return;

    const chatId = mensagem.chat.id;
    const messageId = mensagem.message_id;
    const hoje = formatDateSaoPaulo(agora());

    async function editar(
      texto: string,
      teclado?: InlineKeyboardButton[][],
    ): Promise<void> {
      try {
        await client.editMessageText(
          chatId,
          messageId,
          texto,
          teclado ? { inlineKeyboard: teclado } : {},
        );
      } catch (error) {
        console.error("[telegram] falha ao editar mensagem", error);
        await client.sendMessage(chatId, texto);
      }
    }

    const pendente = await store.buscar(alvo.id);

    if (pendente && pendente.chatId !== chatId) return;

    const expirado =
      pendente !== null &&
      agora().getTime() - Date.parse(pendente.criadoEm) > VALIDADE_PENDENTE_MS;

    if (!pendente || expirado) {
      if (expirado) await store.remover(alvo.id);
      const jaGravado =
        alvo.acao === "ok" && (await repo.buscarLancamentoPorId(alvo.id));
      await editar(jaGravado ? MSG_JA_REGISTRADO : MSG_EXPIRADO);
      return;
    }

    if (alvo.acao === "no") {
      await store.remover(alvo.id);
      await editar(MSG_CANCELADO);
      return;
    }

    if (alvo.acao === "e" || alvo.acao === "d") {
      if (pendente.conteudo.kind !== "tipo") return;
      const lancamento = completarRascunho(
        pendente.conteudo.rascunho,
        alvo.acao === "e" ? "entrada" : "despesa",
        deps.config,
      );
      await store.atualizar({
        ...pendente,
        conteudo: { kind: "lancamento", lancamento },
      });
      await editar(
        textoConfirmacao(lancamento, dataDoPendente(pendente)),
        tecladoConfirmacao(pendente.id),
      );
      return;
    }

    // alvo.acao === "ok"
    if (pendente.conteudo.kind !== "lancamento") return;
    const lancamento = pendente.conteudo.lancamento;

    // Idempotência: se um clique anterior gravou mas não conseguiu limpar o
    // pendente, não grava de novo.
    if (await repo.buscarLancamentoPorId(pendente.id)) {
      await store.remover(pendente.id);
      await editar(MSG_JA_REGISTRADO);
      return;
    }

    await gravar(pendente, lancamento);
    await store.remover(pendente.id);
    await editar(await textoRegistrado(lancamento, hoje));
  }

  async function gravar(
    pendente: Pendente,
    l: LancamentoParseado,
  ): Promise<void> {
    // Sem data informada, vale o momento da mensagem (e não o do clique), para
    // que o registro coincida com o que foi mostrado na confirmação.
    const momento = new Date(pendente.criadoEm);
    const base = {
      id: pendente.id,
      data: l.data ?? formatDateSaoPaulo(momento),
      hora: formatTimeSaoPaulo(momento),
      descricao: l.descricao,
      valor: l.valor,
      categoria: l.categoria,
      origem: "telegram",
      telegramUserId: String(pendente.userId),
    };
    if (l.tipo === "despesa") {
      await repo.criarDespesa({
        ...base,
        formaPagamento: l.formaPagamento ?? FORMA_NAO_INFORMADA,
      });
    } else {
      await repo.criarEntrada(base);
    }
  }

  async function textoRegistrado(
    l: LancamentoParseado,
    hoje: string,
  ): Promise<string> {
    const linhas = [
      "Registrado.",
      "",
      `${l.tipo === "despesa" ? "Despesa" : "Entrada"}: ${formatarMoeda(l.valor)}`,
      `Categoria: ${l.categoria}`,
    ];

    // Os totais são um extra: se a leitura falhar, o registro já está salvo.
    try {
      const { ano, mes } = getAnoMesAtual(agora());
      const doMes = (await repo.listarLancamentosDoMes(ano, mes)).filter(
        (x) => x.tipo === l.tipo,
      );
      const totalMes = formatarMoeda(soma(doMes.map((x) => x.valor)));
      linhas.push("");
      if (l.tipo === "despesa") {
        const totalHoje = soma(
          doMes.filter((x) => x.data === hoje).map((x) => x.valor),
        );
        linhas.push(
          `Total gasto hoje: ${formatarMoeda(totalHoje)}`,
          `Total gasto no mês: ${totalMes}`,
        );
      } else {
        linhas.push(`Total de entradas no mês: ${totalMes}`);
      }
    } catch (error) {
      console.error("[telegram] falha ao calcular totais", error);
    }
    return linhas.join("\n");
  }

  return { onText, onCallback };
}
