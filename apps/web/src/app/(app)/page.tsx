import Link from "next/link";
import type { StockThresholds } from "@ct/core";
import { formatBRL } from "@ct/core";
import { StockBar } from "@/components/stock-bar";
import { MODULOS, href } from "@/modules/registry";

// Dados de EXEMPLO só para mostrar o visual até o módulo de produtos existir (Fase 1).
const LIMITES: StockThresholds = { acabou: 0, muitoBaixo: 50, acabando: 120, metade: 250, cheio: 500 };
const EXEMPLOS = [
  { nome: "Produto A", qty: 480, preco: 1250 },
  { nome: "Produto B", qty: 230, preco: 1500 },
  { nome: "Produto C", qty: 95, preco: 1100 },
  { nome: "Produto D", qty: 32, preco: 1800 },
  { nome: "Produto E", qty: 0, preco: 1300 },
];

export default function Painel() {
  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Painel</h1>
        <p className="text-sm text-muted">Fundação pronta. Os módulos chegam fase a fase.</p>
      </header>

      <section>
        <h2 className="mb-3 text-sm font-medium text-muted">
          Estoque <span className="text-faint">· exemplo visual</span>
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {EXEMPLOS.map((p) => (
            <div key={p.nome} className="rounded-xl border border-line bg-card p-4">
              <div className="mb-3 flex items-baseline justify-between">
                <span className="font-medium">{p.nome}</span>
                <span className="text-xs text-muted tabular-nums">{formatBRL(p.preco)}/g</span>
              </div>
              <StockBar qty={p.qty} limites={LIMITES} />
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-medium text-muted">Módulos</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {MODULOS.filter((m) => m.slug).map((m) => {
            const Icon = m.icon;
            return (
              <Link
                key={m.slug}
                href={href(m)}
                className="rounded-xl border border-line bg-card p-4 transition-colors hover:bg-hover"
              >
                <Icon size={20} strokeWidth={1.75} className="mb-3 text-accent" />
                <div className="font-medium">{m.label}</div>
                <div className="text-xs text-muted">{m.resumo}</div>
                <div className="mt-2 text-[11px] text-faint">Fase {m.fase}</div>
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}
