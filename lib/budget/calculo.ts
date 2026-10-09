import type { ResumoMensal } from "@/types/finance";
import { formatarMoeda } from "@/lib/dashboard/formatar";
import {
  grupoDaCategoria,
  GRUPOS,
  ROTULO_GRUPO,
  type ConfigOrcamento,
  type Grupo,
} from "./config";

export interface OrcamentoGrupo {
  grupo: Grupo;
  percentual: number;
  /** Necessidades e desejos: limite de gasto. Objetivos: meta a guardar. */
  planejado: number;
  realizado: number;
  /** Quanto falta para o limite (gasto) ou para a meta (objetivos); nunca negativo. */
  restante: number;
  /** Só para necessidades e desejos: gasto acima do limite. */
  excesso: number;
}

export interface Orcamento {
  renda: number;
  grupos: OrcamentoGrupo[];
  /** Limite de necessidades + desejos menos o já gasto neles (pode ser negativo). */
  podeGastar: number;
  /** Dias até o fim do mês, contando hoje; `null` se o mês exibido não é o atual. */
  diasRestantes: number | null;
  limiteDiario: number | null;
  sugestoes: string[];
}

export interface Hoje {
  ano: number;
  mes: number;
  dia: number;
}

/** `null` quando não há entradas no mês: sem renda não há orçamento a calcular. */
export function calcularOrcamento(
  resumo: ResumoMensal,
  config: ConfigOrcamento,
  hoje: Hoje,
): Orcamento | null {
  const renda = resumo.totalEntradas;
  if (renda <= 0) return null;

  const gasto: Record<Grupo, number> = { necessidade: 0, desejo: 0, objetivo: 0 };
  for (const [categoria, valor] of Object.entries(resumo.despesasPorCategoria)) {
    gasto[grupoDaCategoria(categoria, config)] += valor;
  }

  const grupos = GRUPOS.map((grupo): OrcamentoGrupo => {
    const percentual = config.percentuais[grupo];
    const planejado = (renda * percentual) / 100;
    const realizado = gasto[grupo];
    const limite = grupo !== "objetivo";
    return {
      grupo,
      percentual,
      planejado,
      realizado,
      restante: Math.max(planejado - realizado, 0),
      excesso: limite ? Math.max(realizado - planejado, 0) : 0,
    };
  });

  const planejadoGastos = grupos
    .filter((g) => g.grupo !== "objetivo")
    .reduce((t, g) => t + g.planejado, 0);
  const realizadoGastos = gasto.necessidade + gasto.desejo;
  const podeGastar = planejadoGastos - realizadoGastos;

  const noMesAtual = hoje.ano === resumo.ano && hoje.mes === resumo.mes;
  const diasNoMes = new Date(resumo.ano, resumo.mes, 0).getDate();
  const diasRestantes = noMesAtual ? Math.max(diasNoMes - hoje.dia + 1, 1) : null;
  const limiteDiario =
    diasRestantes !== null && podeGastar > 0 ? podeGastar / diasRestantes : null;

  const sugestoes: string[] = [
    `Você recebeu ${formatarMoeda(renda)} neste mês e gastou ${formatarMoeda(resumo.totalDespesas)}.`,
  ];
  for (const g of grupos) {
    if (g.excesso > 0) {
      sugestoes.push(
        `Você está ${formatarMoeda(g.excesso)} acima do limite planejado para ${ROTULO_GRUPO[g.grupo].toLowerCase()} (${formatarMoeda(g.planejado)}).`,
      );
    }
  }
  if (podeGastar > 0) {
    sugestoes.push(
      limiteDiario !== null && diasRestantes !== null
        ? `Mantendo o orçamento, você ainda pode gastar cerca de ${formatarMoeda(podeGastar)} (média de ${formatarMoeda(limiteDiario)} por dia nos ${diasRestantes} dias restantes).`
        : `Neste mês sobraram ${formatarMoeda(podeGastar)} dentro do orçamento de gastos.`,
    );
  } else {
    sugestoes.push("O orçamento de gastos do mês (necessidades + desejos) já foi atingido.");
  }
  const objetivo = grupos.find((g) => g.grupo === "objetivo");
  if (objetivo && objetivo.restante > 0) {
    sugestoes.push(
      `Faltam ${formatarMoeda(objetivo.restante)} para a meta de objetivos (${objetivo.percentual}% da renda).`,
    );
  }

  return { renda, grupos, podeGastar, diasRestantes, limiteDiario, sugestoes };
}
