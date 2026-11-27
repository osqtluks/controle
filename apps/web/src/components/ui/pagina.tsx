import Link from "next/link";
import type { ReactNode } from "react";
import { ChevronLeft } from "lucide-react";

export function Cabecalho({
  titulo,
  sub,
  voltar,
  acoes,
}: {
  titulo: ReactNode;
  sub?: ReactNode;
  voltar?: string;
  acoes?: ReactNode;
}) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        {voltar && (
          <Link href={voltar} className="mb-1 inline-flex items-center gap-1 text-xs text-muted hover:text-fg">
            <ChevronLeft size={14} /> Voltar
          </Link>
        )}
        <h1 className="truncate text-2xl font-semibold tracking-tight">{titulo}</h1>
        {sub && <p className="text-sm text-muted">{sub}</p>}
      </div>
      {acoes && <div className="flex gap-2">{acoes}</div>}
    </header>
  );
}

export function Carregando({ linhas = 3 }: { linhas?: number }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3" aria-busy>
      {Array.from({ length: linhas }, (_, i) => (
        <div key={i} className="h-40 animate-pulse rounded-xl border border-line bg-card" />
      ))}
    </div>
  );
}

export function Secao({ titulo, children, acoes }: { titulo: string; children: ReactNode; acoes?: ReactNode }) {
  return (
    <section className="rounded-xl border border-line bg-card p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="font-medium">{titulo}</h2>
        {acoes}
      </div>
      {children}
    </section>
  );
}

export const linkBotao =
  "inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-black hover:opacity-90";
export const linkBotaoSec =
  "inline-flex items-center gap-2 rounded-lg border border-line bg-card px-4 py-2.5 text-sm font-semibold hover:bg-hover";
