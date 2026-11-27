import { notFound } from "next/navigation";
import { MODULOS } from "@/modules/registry";

// Página "em breve" para todo módulo que ainda não tem rota própria.
// Quando um módulo ganha `src/app/<slug>/page.tsx`, a rota própria tem prioridade.
export function generateStaticParams() {
  return MODULOS.filter((m) => m.slug && !m.pronto).map((m) => ({ modulo: m.slug }));
}

export default async function EmBreve({ params }: PageProps<"/[modulo]">) {
  const { modulo } = await params;
  const m = MODULOS.find((x) => x.slug === modulo);
  if (!m) notFound();
  const Icon = m.icon;
  return (
    <div className="mx-auto flex max-w-md flex-col items-center pt-24 text-center">
      <Icon size={36} strokeWidth={1.5} className="mb-4 text-accent" />
      <h1 className="text-xl font-semibold">{m.label}</h1>
      <p className="mt-1 text-sm text-muted">{m.resumo}</p>
      <p className="mt-6 rounded-full border border-line px-3 py-1 text-xs text-faint">Chega na fase {m.fase}</p>
    </div>
  );
}
