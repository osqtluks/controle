import Link from "next/link";
import { CalendarClock, ImageOff } from "lucide-react";
import { custoPorGrama, formatBRL, formatBps, formatLucro, margemBps } from "@ct/core";
import { StockBar } from "@/components/stock-bar";
import { diasAte, formatData } from "@/lib/datas";
import { cn } from "@/lib/cn";
import { limitesDe, type ProdutoEstoque } from "../tipos";
import { AcoesLixeira, BotaoLixeiraCard } from "./botoes-lixeira";

export type ProdutoCardDados = ProdutoEstoque & {
  foto_url: string | null;
  /** Vendas reais (quando a página carrega o desempenho). */
  faturado_cents?: number;
  lucro_real_cents?: number;
};

/** Selo do próximo pagamento a prazo: vermelho (vencido/hoje), laranja (até 3 dias), neutro. */
export function SeloVencimento({ data }: { data: string | null }) {
  if (!data) return null;
  const d = diasAte(data);
  const cor = d <= 0 ? "bg-red-500/15 text-red-300" : d <= 3 ? "bg-orange-500/15 text-orange-300" : "bg-hover text-muted";
  const quando = d === 0 ? "hoje" : d === 1 ? "amanhã" : d < 0 ? `há ${-d} dias` : `em ${d} dias`;
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px]", cor)}>
      <CalendarClock size={12} /> pagar {quando} · {formatData(data)}
    </span>
  );
}

export function ProdutoCard({ p }: { p: ProdutoCardDados }) {
  // "Pago/g" é o de referência do produto; sem ele, o custo médio do estoque.
  const custoG = p.custo_ref_cents_por_grama ?? custoPorGrama(p.custo_estoque_cents, p.estoque_dg);
  const margem = custoG !== null ? margemBps(p.preco_cents_por_grama, custoG) : null;

  return (
    <Link
      href={`/produtos/${p.id}`}
      className={cn(
        "group flex flex-col overflow-hidden rounded-xl border border-line bg-card transition-colors hover:border-accent/50",
        p.arquivado && "border-dashed border-red-500/40",
      )}
    >
      <div className="flex gap-3 p-4">
        <div className="size-16 shrink-0 overflow-hidden rounded-lg bg-hover">
          {p.foto_url ? (
            // eslint-disable-next-line @next/next/no-img-element -- URL assinada e temporária do Supabase
            <img src={p.foto_url} alt="" className="size-full object-cover" />
          ) : (
            <div className="flex size-full items-center justify-center text-faint">
              <ImageOff size={20} />
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="truncate font-medium">{p.nome}</h3>
            <div className="flex shrink-0 items-start gap-1">
              <span className="text-sm font-semibold tabular-nums">{formatBRL(p.preco_cents_por_grama)}/g</span>
              {!p.arquivado && <BotaoLixeiraCard id={p.id} nome={p.nome} />}
            </div>
          </div>
          <p className="truncate text-xs text-muted">{p.categoria ?? "Sem categoria"}</p>
          <div className="mt-1.5 flex flex-wrap gap-1">
            <SeloVencimento data={p.proximo_vencimento} />
          </div>
        </div>
      </div>

      <div className="px-4 pb-3">
        <StockBar qty={p.estoque_dg} limites={limitesDe(p)} />
      </div>

      {p.arquivado && (
        <div className="px-4 pb-3">
          <AcoesLixeira id={p.id} nome={p.nome} />
        </div>
      )}

      <dl className="mt-auto grid grid-cols-3 border-t border-line text-center text-[11px]">
        <div className="px-2 py-2">
          <dt className="text-faint">Pago/g</dt>
          <dd className="tabular-nums text-muted">{custoG !== null ? formatBRL(custoG) : "—"}</dd>
        </div>
        <div className="border-x border-line px-2 py-2">
          <dt className="text-faint">Lucro/g</dt>
          <dd className={cn("tabular-nums", margem !== null && margem < 0 ? "text-red-400" : "text-muted")}>
            {custoG !== null ? formatLucro(p.preco_cents_por_grama - custoG) : "—"}
            {margem !== null && <span className="ml-1 text-faint">({formatBps(margem)})</span>}
          </dd>
        </div>
        <div className="px-2 py-2">
          <dt className="text-faint">Faturado</dt>
          <dd className="tabular-nums text-muted">
            {formatBRL(p.faturado_cents ?? 0)}
            {p.lucro_real_cents ? (
              <span className={cn("block text-[10px]", p.lucro_real_cents < 0 ? "text-red-400" : "text-emerald-400")}>
                {formatLucro(p.lucro_real_cents)} lucro
              </span>
            ) : null}
          </dd>
        </div>
      </dl>
    </Link>
  );
}
