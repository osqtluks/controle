import { desempenho, formatBps, formatBRL, formatGrams, formatLucro, potencialDoEstoque, type TabelaPreco } from "@ct/core";
import { cn } from "@/lib/cn";
import type { DesempenhoProduto } from "../dados";

/**
 * Desempenho real do produto: o que já entrou (faturado), quanto disso é lucro,
 * quanto do que foi pago nas compras já voltou, e o que o estoque restante ainda pode render.
 */
export function DesempenhoBloco({
  d,
  estoqueDg,
  tabela,
}: {
  d: DesempenhoProduto | undefined;
  estoqueDg: number;
  tabela: TabelaPreco;
}) {
  const faturado = d?.faturado_cents ?? 0;
  const investido = d?.investido_cents ?? 0;
  const r = desempenho(faturado, d?.custo_vendido_cents ?? 0, investido);
  const recuperado = r.recuperadoBps ?? 0;
  const pctBarra = Math.min(100, recuperado / 100);
  const pagouTudo = recuperado >= 10000;
  const pot = potencialDoEstoque(estoqueDg, tabela);

  return (
    <div className="space-y-3 rounded-lg bg-bg/60 p-3">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[11px] uppercase tracking-wide text-faint">Desempenho</span>
        <span className="text-[11px] text-faint">
          {d?.vendas ?? 0} venda(s) · {formatGrams(d?.vendido_dg ?? 0)} vendidos
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <div className="text-[11px] text-faint">Faturado</div>
          <div className="text-lg font-semibold tabular-nums">{formatBRL(faturado)}</div>
        </div>
        <div>
          <div className="text-[11px] text-faint">Lucro</div>
          <div className={cn("text-lg font-semibold tabular-nums", r.lucroCents < 0 ? "text-red-400" : faturado ? "text-emerald-400" : "")}>
            {formatLucro(r.lucroCents)}
          </div>
          {r.margemBps !== null && <div className="text-[11px] text-muted">margem real {formatBps(r.margemBps)}</div>}
        </div>
      </div>

      {investido > 0 && (
        <div className="space-y-1">
          <div className="flex justify-between text-[11px]">
            <span className="text-muted">
              {pagouTudo ? "Pagou tudo que comprou" : "Do que você pagou, já voltou"}
            </span>
            <span className={cn("font-semibold tabular-nums", pagouTudo ? "text-emerald-400" : "text-fg")}>
              {formatBps(recuperado)}
            </span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-black/40">
            <div
              className={cn("h-full rounded-full transition-[width] duration-700", pagouTudo ? "bg-emerald-500" : "bg-sky-500")}
              style={{ width: `${pctBarra}%` }}
            />
          </div>
          <div className="text-[11px] text-faint">
            {formatBRL(faturado)} de {formatBRL(investido)} investidos
            {pagouTudo && <span className="text-emerald-400"> · +{formatBRL(faturado - investido)} além do investido</span>}
          </div>
        </div>
      )}

      {estoqueDg > 0 && (
        <div className="text-[11px] text-muted">
          O que sobra ({formatGrams(estoqueDg)}) pode render{" "}
          {pot.minCents === pot.maxCents ? (
            <b className="text-fg">{formatBRL(pot.maxCents)}</b>
          ) : (
            <>
              de <b className="text-fg">{formatBRL(pot.minCents)}</b> a <b className="text-fg">{formatBRL(pot.maxCents)}</b>
            </>
          )}{" "}
          (sem descontos)
        </div>
      )}
    </div>
  );
}
