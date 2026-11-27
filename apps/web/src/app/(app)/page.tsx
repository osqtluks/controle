import Link from "next/link";
import { Suspense } from "react";
import { NIVEIS_DE_ALERTA, stockLevel, stockPercent } from "@ct/core";
import { StockBar } from "@/components/stock-bar";
import { MODULOS, href } from "@/modules/registry";
import { listarProdutos } from "@/modules/produtos/dados";
import { SeloVencimento } from "@/modules/produtos/componentes/card";
import { limitesDe } from "@/modules/produtos/tipos";
import { diasAte } from "@/lib/datas";

function Bloco({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-line bg-card p-4">
      <h2 className="mb-3 text-sm font-medium text-muted">{titulo}</h2>
      {children}
    </section>
  );
}

async function Alertas() {
  const produtos = await listarProdutos();
  const repor = produtos
    .filter((p) => NIVEIS_DE_ALERTA.has(stockLevel(p.estoque_dg, limitesDe(p))))
    .sort((a, b) => stockPercent(a.estoque_dg, limitesDe(a)) - stockPercent(b.estoque_dg, limitesDe(b)));
  const pagar = produtos
    .filter((p) => p.proximo_vencimento && diasAte(p.proximo_vencimento) <= 7)
    .sort((a, b) => a.proximo_vencimento!.localeCompare(b.proximo_vencimento!));

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Bloco titulo={`Repor estoque (${repor.length})`}>
        {repor.length === 0 ? (
          <p className="text-sm text-muted">Tudo abastecido. 👌</p>
        ) : (
          <ul className="space-y-3">
            {repor.map((p) => (
              <li key={p.id}>
                <Link href={`/produtos/${p.id}`} className="block space-y-1 hover:opacity-80">
                  <span className="text-sm font-medium">{p.nome}</span>
                  <StockBar qty={p.estoque_dg} limites={limitesDe(p)} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Bloco>
      <Bloco titulo={`Pagamentos a prazo nos próximos 7 dias (${pagar.length})`}>
        {pagar.length === 0 ? (
          <p className="text-sm text-muted">Nada vencendo esta semana.</p>
        ) : (
          <ul className="space-y-2">
            {pagar.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-2">
                <Link href={`/produtos/${p.id}`} className="truncate text-sm hover:underline">
                  {p.nome}
                </Link>
                <SeloVencimento data={p.proximo_vencimento} />
              </li>
            ))}
          </ul>
        )}
      </Bloco>
    </div>
  );
}

export default function Painel() {
  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Painel</h1>
        <p className="text-sm text-muted">O que precisa da sua atenção agora.</p>
      </header>

      <Suspense fallback={<div className="h-40 animate-pulse rounded-xl border border-line bg-card" />}>
        <Alertas />
      </Suspense>

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
                <div className="mt-2 text-[11px] text-faint">{m.pronto ? "Disponível" : `Fase ${m.fase}`}</div>
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}
