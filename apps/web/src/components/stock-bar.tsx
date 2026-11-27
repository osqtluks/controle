import {
  STOCK_LEVEL_LABEL,
  formatGrams,
  stockLevel,
  stockPercent,
  type Dg,
  type StockLevel,
  type StockThresholds,
} from "@ct/core";
import { cn } from "@/lib/cn";

const COR: Record<StockLevel, string> = {
  cheio: "from-emerald-400 to-emerald-500 shadow-emerald-500/40",
  bom: "from-lime-400 to-emerald-500 shadow-lime-500/40",
  metade: "from-yellow-300 to-amber-400 shadow-amber-400/40",
  acabando: "from-orange-400 to-orange-500 shadow-orange-500/40",
  muito_baixo: "from-red-500 to-rose-600 shadow-red-500/50",
  acabou: "from-zinc-600 to-zinc-700 shadow-transparent",
};

const TEXTO: Record<StockLevel, string> = {
  cheio: "text-emerald-400",
  bom: "text-lime-400",
  metade: "text-amber-300",
  acabando: "text-orange-400",
  muito_baixo: "text-red-400",
  acabou: "text-zinc-400",
};

/** Barra de estoque no estilo "barra de vida" de jogo: 10 segmentos que esvaziam. */
export function StockBar({ qty, limites, compacta }: { qty: Dg; limites: StockThresholds; compacta?: boolean }) {
  const nivel = stockLevel(qty, limites);
  const pct = stockPercent(qty, limites);
  const critico = nivel === "muito_baixo" || nivel === "acabou";

  return (
    <div className="w-full">
      {!compacta && (
        <div className="mb-1.5 flex items-baseline justify-between text-xs">
          <span className={cn("font-semibold uppercase tracking-wider", TEXTO[nivel])}>{STOCK_LEVEL_LABEL[nivel]}</span>
          <span className="tabular-nums text-muted">
            {formatGrams(qty)} <span className="text-faint">/ {formatGrams(limites.cheio)}</span>
          </span>
        </div>
      )}
      <div
        role="meter"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        aria-label={`Estoque: ${STOCK_LEVEL_LABEL[nivel]}, ${pct}%`}
        className="relative h-3.5 overflow-hidden rounded-md border border-white/10 bg-black/40 p-[2px]"
      >
        <div
          className={cn(
            "h-full rounded-[3px] bg-gradient-to-r shadow-[0_0_12px] transition-[width] duration-700 ease-out",
            COR[nivel],
            critico && "animate-pulse",
          )}
          style={{ width: `${Math.max(pct, nivel === "acabou" ? 0 : 3)}%` }}
        />
        {/* divisórias dos 10 segmentos */}
        <div className="pointer-events-none absolute inset-[2px] grid grid-cols-10">
          {Array.from({ length: 10 }, (_, i) => (
            <span key={i} className="border-r border-black/50 last:border-r-0" />
          ))}
        </div>
      </div>
    </div>
  );
}
