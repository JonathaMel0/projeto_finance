import { randomUUID } from "node:crypto";
import { formatDateSaoPaulo } from "@/lib/finance/datetime";
import type { AuditLog } from "@/lib/finance/audit-log";
import type { FinanceRepository } from "@/lib/finance/repository";
import {
  interpretarCampo,
  nomesDeCategoria,
  reconhecerCampo,
  ROTULO_CAMPO,
  type CampoEditavel,
  type ParserConfig,
} from "@/lib/parser";
import type { Lancamento } from "@/types/finance";
import type { TelegramClient } from "./client";
import {
  dataDoPendente,
  MSG_EXPIRADO,
  tecladoConfirmacao,
  textoConfirmacao,
} from "./fluxo";
import { formatarData, formatarMoeda } from "./formatacao";
import {
  VALIDADE_EDICAO_MS,
  VALIDADE_PENDENTE_MS,
  type PendingStore,
  type Pendente,
} from "./pending-store";
import type {
  InlineKeyboardButton,
  TelegramCallbackQuery,
  TelegramMessage,
} from "./types";

export const MSG_NAO_ENCONTRADO =
  "Não encontrei esse lançamento. Ele pode já ter sido excluído.";
export const MSG_CANCELADO_EDICAO = "Cancelado.";

const LIMITE_LISTA = 5;

const ABREVIACAO_CAMPO: Record<string, CampoEditavel> = {
  d: "descricao",
  v: "valor",
  c: "categoria",
  t: "data",
};

const ABREVIACAO_INVERSA: Record<CampoEditavel, string> = {
  descricao: "d",
  valor: "v",
  categoria: "c",
  data: "t",
};

const COMANDO_TEXTUAL = /^(editar|excluir|ultimos|últimos)(?:\s+([\s\S]*))?$/i;
const CALLBACK = /^(es|ec|xs|xy|pe|pc|pv|ea|cx):([\s\S]*)$/;

const USO_EDITAR =
  "Use: editar 1 valor 59,90\nCampos: descrição, valor, categoria, data.\nSem argumentos, mostro os últimos lançamentos para você escolher.";

export interface EdicaoDeps {
  client: TelegramClient;
  repo: FinanceRepository;
  store: PendingStore;
  config?: ParserConfig;
  audit?: AuditLog;
  agora?: () => Date;
  novoId?: () => string;
}

function resumo(l: Lancamento): string {
  return [
    l.tipo === "despesa" ? "Despesa" : "Entrada",
    l.descricao,
    formatarMoeda(l.valor),
    formatarData(l.data),
    l.categoria,
  ].join(" · ");
}

function detalhe(l: Lancamento): string {
  return [
    `Tipo: ${l.tipo === "despesa" ? "Despesa" : "Entrada"}`,
    `Descrição: ${l.descricao}`,
    `Valor: ${formatarMoeda(l.valor)}`,
    `Categoria: ${l.categoria}`,
    `Data: ${formatarData(l.data)}`,
  ].join("\n");
}

function tecladoCampos(
  prefixo: "ec" | "pc",
  id: string,
  cancelar: InlineKeyboardButton,
): InlineKeyboardButton[][] {
  const botao = (campo: CampoEditavel): InlineKeyboardButton => ({
    text: ROTULO_CAMPO[campo],
    callback_data: `${prefixo}:${ABREVIACAO_INVERSA[campo]}:${id}`,
  });
  return [
    [botao("descricao"), botao("valor")],
    [botao("categoria"), botao("data")],
    [cancelar],
  ];
}

const BOTAO_CANCELAR: InlineKeyboardButton = {
  text: "❌ Cancelar",
  callback_data: "cx:0",
};

function dica(campo: CampoEditavel, categorias: string[]): string {
  switch (campo) {
    case "valor":
      return "Exemplo: 59,90";
    case "descricao":
      return "Exemplo: Padaria do bairro";
    case "data":
      return "Exemplo: hoje, ontem, dia 5 ou 05/09/2026";
    case "categoria":
      return `Opções: ${categorias.join(", ")}`;
  }
}

/**
 * Edição e exclusão de lançamentos pelo Telegram: `/ultimos`, `/editar`,
 * `/excluir` (com botões ou comando direto) e o botão "Editar" da
 * confirmação. Cada função `on*` devolve `true` quando tratou o evento.
 */
export function criarEdicao(deps: EdicaoDeps) {
  const { client, repo, store } = deps;
  const agora = deps.agora ?? (() => new Date());
  const novoId = deps.novoId ?? randomUUID;

  async function ultimos(): Promise<Lancamento[]> {
    const todos = await repo.listarLancamentos();
    return todos
      .sort((a, b) =>
        `${b.createdAt}${b.data}${b.hora}`.localeCompare(
          `${a.createdAt}${a.data}${a.hora}`,
        ),
      )
      .slice(0, LIMITE_LISTA);
  }

  function textoLista(lista: Lancamento[], titulo: string): string {
    return [
      titulo,
      "",
      ...lista.map((l, i) => `${i + 1}. ${resumo(l)}`),
    ].join("\n");
  }

  function tecladoLista(
    lista: Lancamento[],
    prefixo: "es" | "xs",
  ): InlineKeyboardButton[][] {
    return [
      lista.map((l, i) => ({
        text: String(i + 1),
        callback_data: `${prefixo}:${l.id}`,
      })),
      [BOTAO_CANCELAR],
    ];
  }

  // ---- Comandos --------------------------------------------------------

  async function onComando(
    comando: string,
    args: string,
    message: TelegramMessage,
  ): Promise<boolean> {
    if (comando !== "ultimos" && comando !== "editar" && comando !== "excluir") {
      return false;
    }
    const chatId = message.chat.id;
    const opcoes =
      message.chat.type === "private"
        ? {}
        : { replyToMessageId: message.message_id };
    const responder = (
      texto: string,
      inlineKeyboard?: InlineKeyboardButton[][],
    ) => client.sendMessage(chatId, texto, { ...opcoes, inlineKeyboard });

    const lista = await ultimos();
    if (lista.length === 0) {
      await responder("Ainda não há lançamentos registrados.");
      return true;
    }

    const argumentos = args.trim();

    if (comando === "ultimos") {
      await responder(textoLista(lista, "Últimos lançamentos:"));
      return true;
    }

    if (argumentos === "") {
      await responder(
        textoLista(
          lista,
          comando === "editar"
            ? "Qual lançamento deseja editar?"
            : "Qual lançamento deseja excluir?",
        ),
        tecladoLista(lista, comando === "editar" ? "es" : "xs"),
      );
      return true;
    }

    const indice = /^(\d+)(?:\s+([\s\S]*))?$/.exec(argumentos);
    const alvo = indice ? lista[Number(indice[1]) - 1] : undefined;
    if (!indice || !alvo) {
      await responder(
        indice
          ? `Não encontrei o lançamento ${indice[1]}. Use /ultimos para ver a lista.`
          : comando === "editar"
            ? USO_EDITAR
            : "Use: excluir 1 (o número vem de /ultimos).",
      );
      return true;
    }

    const resto = (indice[2] ?? "").trim();

    if (comando === "excluir") {
      await responder(
        textoConfirmarExclusao(alvo),
        tecladoConfirmarExclusao(alvo.id),
      );
      return true;
    }

    if (resto === "") {
      await responder(
        `${detalhe(alvo)}\n\nO que deseja alterar?`,
        tecladoCampos("ec", alvo.id, BOTAO_CANCELAR),
      );
      return true;
    }

    const partes = /^(\S+)\s+([\s\S]+)$/.exec(resto);
    const campo = partes ? reconhecerCampo(partes[1] ?? "") : null;
    if (!partes || !campo) {
      await responder(USO_EDITAR);
      return true;
    }

    const resultado = interpretarCampo(campo, partes[2] ?? "", {
      tipo: alvo.tipo,
      hoje: formatDateSaoPaulo(agora()),
      config: deps.config,
    });
    if (!resultado.ok) {
      await responder(resultado.erro);
      return true;
    }
    const atualizado = await aplicarEdicao(
      alvo,
      campo,
      resultado.valor,
      message.from?.id,
    );
    await responder(`Atualizado:\n${resumo(atualizado)}`);
    return true;
  }

  function textoConfirmarExclusao(l: Lancamento): string {
    return `Deseja realmente excluir?\n\n${detalhe(l)}`;
  }

  function tecladoConfirmarExclusao(id: string): InlineKeyboardButton[][] {
    return [
      [
        { text: "✅ Sim, excluir", callback_data: `xy:${id}` },
        { text: "❌ Não", callback_data: "cx:0" },
      ],
    ];
  }

  async function aplicarEdicao(
    antes: Lancamento,
    campo: CampoEditavel,
    valor: string | number,
    usuario: number | undefined,
  ): Promise<Lancamento> {
    const depois = await repo.atualizarLancamento(antes.id, {
      [campo]: valor,
    });
    await deps.audit?.registrar({
      operacao: "edicao",
      detalhes: {
        id: antes.id,
        campo,
        de: antes[campo],
        para: depois[campo],
        usuario,
      },
    });
    return depois;
  }

  // ---- Texto livre (comando sem barra ou resposta de uma edição aberta) --

  async function onTexto(message: TelegramMessage): Promise<boolean> {
    const texto = message.text?.trim();
    const userId = message.from?.id;
    if (!texto || userId === undefined) return false;

    const comando = COMANDO_TEXTUAL.exec(texto);
    if (comando) {
      const nome = (comando[1] ?? "")
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .toLowerCase();
      return onComando(nome, comando[2] ?? "", message);
    }

    const chatId = message.chat.id;
    const aberta = await store.buscarEdicaoAberta(chatId, userId);
    if (!aberta || aberta.conteudo.kind !== "edicao") return false;

    if (agora().getTime() - Date.parse(aberta.criadoEm) > VALIDADE_EDICAO_MS) {
      await store.remover(aberta.id);
      return false;
    }

    const { alvo, campo, messageId } = aberta.conteudo;
    const hoje = formatDateSaoPaulo(agora());

    async function atualizarMensagem(
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
        await client.sendMessage(
          chatId,
          texto,
          teclado ? { inlineKeyboard: teclado } : {},
        );
      }
    }

    if (alvo.tipo === "pendente") {
      const pendente = await store.buscar(alvo.id);
      if (!pendente || pendente.conteudo.kind !== "lancamento") {
        await store.remover(aberta.id);
        await atualizarMensagem(MSG_EXPIRADO);
        return true;
      }
      const atual = pendente.conteudo.lancamento;
      const resultado = interpretarCampo(campo, texto, {
        tipo: atual.tipo,
        hoje,
        config: deps.config,
      });
      if (!resultado.ok) {
        await client.sendMessage(chatId, resultado.erro);
        return true;
      }
      const lancamento = { ...atual, [campo]: resultado.valor };
      await store.atualizar({
        ...pendente,
        conteudo: { kind: "lancamento", lancamento },
      });
      await store.remover(aberta.id);
      await atualizarMensagem(
        textoConfirmacao(lancamento, dataDoPendente(pendente)),
        tecladoConfirmacao(pendente.id),
      );
      return true;
    }

    const atual = await repo.buscarLancamentoPorId(alvo.id);
    if (!atual) {
      await store.remover(aberta.id);
      await atualizarMensagem(MSG_NAO_ENCONTRADO);
      return true;
    }
    const resultado = interpretarCampo(campo, texto, {
      tipo: atual.tipo,
      hoje,
      config: deps.config,
    });
    if (!resultado.ok) {
      await client.sendMessage(chatId, resultado.erro);
      return true;
    }
    const atualizado = await aplicarEdicao(atual, campo, resultado.valor, userId);
    await store.remover(aberta.id);
    await atualizarMensagem(`Atualizado:\n${resumo(atualizado)}`);
    return true;
  }

  // ---- Botões ----------------------------------------------------------

  async function onCallback(callback: TelegramCallbackQuery): Promise<boolean> {
    const m = CALLBACK.exec(callback.data ?? "");
    const mensagem = callback.message;
    if (!m || !mensagem) return false;
    await client.answerCallbackQuery(callback.id);

    const acao = m[1] as string;
    const resto = m[2] as string;
    const chatId = mensagem.chat.id;
    const messageId = mensagem.message_id;

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
        await client.sendMessage(
          chatId,
          texto,
          teclado ? { inlineKeyboard: teclado } : {},
        );
      }
    }

    async function mostrarConfirmacao(pendente: Pendente): Promise<void> {
      if (pendente.conteudo.kind !== "lancamento") return;
      await editar(
        textoConfirmacao(pendente.conteudo.lancamento, dataDoPendente(pendente)),
        tecladoConfirmacao(pendente.id),
      );
    }

    async function pedirValor(
      alvo: EdicaoAbertaAlvo,
      campo: CampoEditavel,
      tipo: Lancamento["tipo"],
    ): Promise<void> {
      const id = novoId();
      await store.salvar({
        id,
        chatId,
        userId: callback.from.id,
        criadoEm: agora().toISOString(),
        conteudo: { kind: "edicao", alvo, campo, messageId },
      });
      await editar(
        `Envie o novo valor de ${ROTULO_CAMPO[campo]}.\n${dica(campo, nomesDeCategoria(tipo, deps.config))}`,
        [[{ text: "❌ Cancelar", callback_data: `ea:${id}` }]],
      );
    }

    switch (acao) {
      case "cx":
        await editar(MSG_CANCELADO_EDICAO);
        return true;

      case "es": {
        const l = await repo.buscarLancamentoPorId(resto);
        if (!l) {
          await editar(MSG_NAO_ENCONTRADO);
          return true;
        }
        await editar(
          `${detalhe(l)}\n\nO que deseja alterar?`,
          tecladoCampos("ec", l.id, BOTAO_CANCELAR),
        );
        return true;
      }

      case "ec": {
        const [abrev = "", id = ""] = splitUmaVez(resto);
        const campo = ABREVIACAO_CAMPO[abrev];
        const l = campo ? await repo.buscarLancamentoPorId(id) : null;
        if (!campo || !l) {
          await editar(MSG_NAO_ENCONTRADO);
          return true;
        }
        await pedirValor({ tipo: "lancamento", id }, campo, l.tipo);
        return true;
      }

      case "xs": {
        const l = await repo.buscarLancamentoPorId(resto);
        if (!l) {
          await editar(MSG_NAO_ENCONTRADO);
          return true;
        }
        await editar(textoConfirmarExclusao(l), tecladoConfirmarExclusao(l.id));
        return true;
      }

      case "xy": {
        const l = await repo.buscarLancamentoPorId(resto);
        if (!l) {
          await editar(MSG_NAO_ENCONTRADO);
          return true;
        }
        await repo.excluirLancamento(l.id);
        await deps.audit?.registrar({
          operacao: "exclusao",
          detalhes: {
            id: l.id,
            tipo: l.tipo,
            descricao: l.descricao,
            valor: l.valor,
            categoria: l.categoria,
            data: l.data,
            usuario: callback.from.id,
          },
        });
        await editar(`Excluído:\n${resumo(l)}`);
        return true;
      }

      case "pe":
      case "pv": {
        const pendente = await pendenteDoChat(resto, chatId);
        if (!pendente) {
          await editar(MSG_EXPIRADO);
          return true;
        }
        if (acao === "pv") {
          await mostrarConfirmacao(pendente);
          return true;
        }
        await editar(
          "O que deseja alterar?",
          tecladoCampos("pc", pendente.id, {
            text: "↩️ Voltar",
            callback_data: `pv:${pendente.id}`,
          }),
        );
        return true;
      }

      case "pc": {
        const [abrev = "", id = ""] = splitUmaVez(resto);
        const campo = ABREVIACAO_CAMPO[abrev];
        const pendente = campo ? await pendenteDoChat(id, chatId) : null;
        if (!campo || !pendente || pendente.conteudo.kind !== "lancamento") {
          await editar(MSG_EXPIRADO);
          return true;
        }
        await pedirValor(
          { tipo: "pendente", id },
          campo,
          pendente.conteudo.lancamento.tipo,
        );
        return true;
      }

      case "ea": {
        const aberta = await store.buscar(resto);
        if (!aberta || aberta.chatId !== chatId) {
          await editar(MSG_CANCELADO_EDICAO);
          return true;
        }
        await store.remover(aberta.id);
        if (aberta.conteudo.kind === "edicao" && aberta.conteudo.alvo.tipo === "pendente") {
          const pendente = await pendenteDoChat(aberta.conteudo.alvo.id, chatId);
          if (pendente) {
            await mostrarConfirmacao(pendente);
            return true;
          }
        }
        await editar(MSG_CANCELADO_EDICAO);
        return true;
      }
    }
    return false;
  }

  /** Pendente de lançamento válido (existe, é do chat e não expirou). */
  async function pendenteDoChat(
    id: string,
    chatId: number,
  ): Promise<Pendente | null> {
    const pendente = await store.buscar(id);
    if (!pendente || pendente.chatId !== chatId) return null;
    if (pendente.conteudo.kind !== "lancamento") return null;
    if (agora().getTime() - Date.parse(pendente.criadoEm) > VALIDADE_PENDENTE_MS) {
      return null;
    }
    return pendente;
  }

  return { onComando, onTexto, onCallback };
}

type EdicaoAbertaAlvo = { tipo: "lancamento" | "pendente"; id: string };

/** "v:abc:def" -> ["v", "abc:def"] */
function splitUmaVez(texto: string): [string, string] {
  const i = texto.indexOf(":");
  return i === -1 ? [texto, ""] : [texto.slice(0, i), texto.slice(i + 1)];
}
