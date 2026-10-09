export function Painel({
  titulo,
  children,
  className = "",
}: {
  titulo: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-2xl bg-white p-5 ring-1 ring-slate-200/70 ${className}`}>
      <h2 className="mb-4 text-sm font-medium text-slate-500">{titulo}</h2>
      {children}
    </section>
  );
}

export const SEM_DADOS = (
  <p className="py-6 text-center text-sm text-slate-400">Sem dados no período.</p>
);

export const PALETA = [
  "#10b981",
  "#6366f1",
  "#f59e0b",
  "#0ea5e9",
  "#f43f5e",
  "#8b5cf6",
  "#14b8a6",
  "#f97316",
  "#ec4899",
  "#94a3b8",
];
