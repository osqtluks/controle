import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { formatBRL, formatLucro, NIVEIS_DE_ALERTA, situacaoDe, stockLevel, stockPercent, type InfoSituacao } from "@ct/core";
import { StockBar } from "@/components/stock-bar";
import { MODULOS, href } from "@/modules/registry";
import { listarProdutos } from "@/modules/produtos/dados";
import { limitesDe } from "@/modules/produtos/tipos";
import { FUSO, hojeISO } from "@/lib/datas";
import { contasAbertas } from "@/modules/contas/dados";
import type { Conta } from "@/modules/contas/tipos";
import { SeloSituacao } from "@/modules/contas/componentes/lista-contas";
import { totaisDesde } from "@/modules/vendas/dados";
import { Plus } from "lucide-react";

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

  return (
    <div>
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
    </div>
  );
}

function ListaAtencao({ xs }: { xs: (Conta & { info: InfoSituacao })[] }) {
  return (
    <ul className="divide-y divide-line/60">
      {xs.map((c) => (
        <li key={c.id}>
          <Link href={`/contas/${c.id}`} className="flex items-center justify-between gap-3 py-2 hover:opacity-80">
            <div className="min-w-0">
              <div className="truncate text-sm font-medium">
                {c.pessoa?.nome ?? "—"} <span className="font-normal text-muted">· {c.descricao}</span>
              </div>
              <div className={c.tipo === "receber" ? "text-[11px] text-emerald-400/80" : "text-[11px] text-sky-300/80"}>
                {c.tipo === "receber" ? "me deve" : "eu devo"}
                {c.dias_remarcados > 0 && <span className="text-violet-300"> · remarcada +{c.dias_remarcados} dias</span>}
              </div>
            </div>
            <div className="shrink-0 text-right">
              <div className="text-sm font-semibold tabular-nums">{formatBRL(c.restante_cents)}</div>
              <SeloSituacao info={c.info} />
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}

/** Contas atrasadas (vermelho) e vencendo em até 3 dias (laranja), a receber e a pagar. */
async function Atencao() {
  await connection();
  const hoje = hojeISO();
  const contas = (await contasAbertas()).map((c) => ({ ...c, info: situacaoDe(c.restante_cents, c.proximo_vencimento, hoje) }));
  const atrasadas = contas.filter((c) => c.info.situacao === "atrasada").sort((a, b) => (b.info.dias ?? 0) - (a.info.dias ?? 0));
  const logo = contas.filter((c) => c.info.situacao === "vence_logo").sort((a, b) => (b.info.dias ?? 0) - (a.info.dias ?? 0));
  const soma = (xs: typeof contas, t: "receber" | "pagar") => xs.filter((c) => c.tipo === t).reduce((s, c) => s + c.restante_cents, 0);

  if (!atrasadas.length && !logo.length)
    return (
      <section className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4 text-sm text-emerald-300">
        Nenhuma conta atrasada nem vencendo nos próximos dias. ✓
      </section>
    );

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {atrasadas.length > 0 && (
        <section className="rounded-xl border-2 border-red-500/50 bg-red-500/[0.06] p-4">
          <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-red-300">⚠ Atrasadas ({atrasadas.length})</h2>
            <span className="text-[11px] text-red-300/80">
              receber {formatBRL(soma(atrasadas, "receber"))} · pagar {formatBRL(soma(atrasadas, "pagar"))}
            </span>
          </div>
          <ListaAtencao xs={atrasadas} />
        </section>
      )}
      {logo.length > 0 && (
        <section className="rounded-xl border border-orange-500/40 bg-orange-500/[0.05] p-4">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-orange-300">Vencem logo ({logo.length})</h2>
          <ListaAtencao xs={logo} />
        </section>
      )}
    </div>
  );
}

async function ResumoVendas() {
  await connection(); // "hoje" depende da hora da requisição, não do build
  const hoje = hojeISO();
  const vendas = await totaisDesde(`${hoje.slice(0, 7)}-01T00:00:00-03:00`);
  const doDia = vendas.filter((v) => new Date(v.data).toLocaleDateString("en-CA", { timeZone: FUSO }) === hoje);
  const soma = (xs: typeof vendas) => ({
    fat: xs.reduce((s, v) => s + v.total_cents, 0),
    luc: xs.reduce((s, v) => s + v.total_cents - v.custo_cents, 0),
    n: xs.length,
  });
  const blocos = [
    ["Hoje", soma(doDia)],
    ["Este mês", soma(vendas)],
  ] as const;
  return (
    <div className="grid grid-cols-2 gap-3">
      {blocos.map(([rotulo, b]) => (
        <Link key={rotulo} href="/vendas" className="rounded-xl border border-line bg-card p-4 hover:bg-hover">
          <div className="text-xs text-muted">
            {rotulo} · {b.n} venda(s)
          </div>
          <div className="text-xl font-semibold tabular-nums">{formatBRL(b.fat)}</div>
          <div className={b.luc < 0 ? "text-xs text-red-400" : "text-xs text-emerald-400"}>{formatLucro(b.luc)} de lucro</div>
        </Link>
      ))}
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

      <div className="flex justify-end">
        <Link href="/vendas/nova" className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-black hover:opacity-90">
          <Plus size={16} /> Nova venda
        </Link>
      </div>

      <Suspense fallback={<div className="h-32 animate-pulse rounded-xl border border-line bg-card" />}>
        <Atencao />
      </Suspense>

      <Suspense fallback={<div className="h-24 animate-pulse rounded-xl border border-line bg-card" />}>
        <ResumoVendas />
      </Suspense>

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
