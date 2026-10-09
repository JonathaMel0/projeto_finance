import type { Token } from "./texto";

const RELATIVAS: Record<string, number> = {
  hoje: 0,
  ontem: -1,
  anteontem: -2,
  amanha: 1,
};

export type ResultadoData =
  | { ok: true; data?: string }
  | { ok: false; motivo: "data_invalida" | "varias_datas" };

function formatar(ano: number, mes: number, dia: number): string {
  return [
    String(ano).padStart(4, "0"),
    String(mes).padStart(2, "0"),
    String(dia).padStart(2, "0"),
  ].join("-");
}

/** Monta "YYYY-MM-DD" se a data existir no calendário; senão `null`. */
function dataValida(ano: number, mes: number, dia: number): string | null {
  const d = new Date(Date.UTC(ano, mes - 1, dia));
  const confere =
    d.getUTCFullYear() === ano &&
    d.getUTCMonth() === mes - 1 &&
    d.getUTCDate() === dia;
  return confere ? formatar(ano, mes, dia) : null;
}

function somarDias(iso: string, dias: number): string {
  const [ano = 0, mes = 0, dia = 0] = iso.split("-").map(Number);
  const d = new Date(Date.UTC(ano, mes - 1, dia + dias));
  return formatar(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
}

/**
 * Reconhece hoje, ontem, anteontem, amanhã, "dia X", DD/MM e DD/MM/YYYY e
 * marca os tokens consumidos. `hoje` é "YYYY-MM-DD" no fuso de São Paulo.
 */
export function extrairData(tokens: Token[], hoje: string): ResultadoData {
  const [anoAtual = 0, mesAtual = 0] = hoje.split("-").map(Number);
  const achados: { indices: number[]; data: string | null }[] = [];

  tokens.forEach((token, i) => {
    if (token.usado) return;

    const relativo = RELATIVAS[token.norm];
    if (relativo !== undefined) {
      achados.push({ indices: [i], data: somarDias(hoje, relativo) });
      return;
    }

    const proximo = tokens[i + 1];
    if (token.norm === "dia" && proximo && /^\d{1,2}$/.test(proximo.norm)) {
      achados.push({
        indices: [i, i + 1],
        data: dataValida(anoAtual, mesAtual, Number(proximo.norm)),
      });
      return;
    }

    const m = /^(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?$/.exec(token.norm);
    if (m) {
      const ano = m[3] ? Number(m[3]) : anoAtual;
      achados.push({
        indices: [i],
        data: dataValida(ano, Number(m[2]), Number(m[1])),
      });
    }
  });

  if (achados.length === 0) return { ok: true };
  if (achados.length > 1) return { ok: false, motivo: "varias_datas" };

  const [achado] = achados;
  if (!achado || achado.data === null) {
    return { ok: false, motivo: "data_invalida" };
  }
  for (const i of achado.indices) {
    const token = tokens[i];
    if (token) token.usado = true;
  }
  return { ok: true, data: achado.data };
}
