import { criarEdicao } from "./edicao";
import { criarFluxo, type FluxoDeps } from "./fluxo";

/**
 * Junta o fluxo de lançamento (mensagem -> confirmação -> gravação) com o de
 * edição/exclusão. Edição vem primeiro: um comando "editar 1 valor 10" ou a
 * resposta de uma edição aberta não pode virar um lançamento novo.
 */
export function criarBot(deps: FluxoDeps) {
  const fluxo = criarFluxo(deps);
  const edicao = criarEdicao(deps);

  return {
    onText: async (...args: Parameters<typeof fluxo.onText>) => {
      if (await edicao.onTexto(...args)) return;
      await fluxo.onText(...args);
    },
    onCallback: async (...args: Parameters<typeof fluxo.onCallback>) => {
      if (await edicao.onCallback(...args)) return;
      await fluxo.onCallback(...args);
    },
    onCommand: edicao.onComando,
  };
}
