import { descontoDaFaixaBps, formatBps, formatBRL, formatGrams, ordenarFaixas, priceFor, type TabelaPreco } from "@ct/core";
import { cn } from "@/lib/cn";
import type { EstiloMenu } from "@/modules/produtos/tipos";

/** Cores de cada estilo de card. "simples" segue o tema do app; "top" brilha; "premium" é dourado. */
const ESTILO: Record<
  EstiloMenu,
  {
    moldura: string; // borda/fundo externo
    corpo: string;
    nome: string;
    sub: string;
    linha: string;
    destaque: string;
    destaqueSub: string;
    preco: string;
    rotulo: string;
    selo: string;
    descricao: string;
    desconto: string;
    desconto_dest: string;
  }
> = {
  simples: {
    moldura: "rounded-2xl border border-line bg-card",
    corpo: "rounded-2xl",
    nome: "text-fg",
    sub: "text-muted",
    linha: "bg-bg/70",
    destaque: "bg-accent text-black",
    destaqueSub: "text-black/70",
    preco: "text-fg",
    rotulo: "text-muted",
    selo: "bg-accent/15 text-accent border border-accent/40",
    descricao: "text-muted",
    desconto: "bg-accent/15 text-accent",
    desconto_dest: "bg-black/15 text-black",
  },
  top: {
    moldura:
      "rounded-2xl border border-emerald-400/50 bg-gradient-to-b from-[#0d2219] via-[#0b1310] to-[#08100c] shadow-[0_0_40px_-6px_rgba(52,211,153,0.45)]",
    corpo: "rounded-2xl",
    nome: "text-white drop-shadow-[0_0_10px_rgba(52,211,153,0.6)]",
    sub: "text-emerald-200/70",
    linha: "bg-white/[0.04] ring-1 ring-emerald-400/15",
    destaque: "bg-gradient-to-r from-emerald-400 to-lime-300 text-black shadow-[0_0_24px_rgba(52,211,153,0.55)]",
    destaqueSub: "text-black/70",
    preco: "text-white drop-shadow-[0_0_8px_rgba(52,211,153,0.35)]",
    rotulo: "text-emerald-200/70",
    selo: "bg-emerald-400/15 text-emerald-300 border border-emerald-400/50 shadow-[0_0_12px_rgba(52,211,153,0.4)]",
    descricao: "text-emerald-50/80",
    desconto: "bg-emerald-400/20 text-emerald-300",
    desconto_dest: "bg-black/20 text-black",
  },
  premium: {
    moldura:
      "rounded-2xl bg-gradient-to-br from-amber-200 via-yellow-500 to-amber-700 p-[2px] shadow-[0_0_44px_-8px_rgba(251,191,36,0.55)]",
    corpo: "rounded-[14px] bg-gradient-to-b from-[#16120a] via-[#0c0a06] to-[#070604]",
    nome: "bg-gradient-to-r from-amber-100 via-yellow-300 to-amber-500 bg-clip-text text-transparent",
    sub: "text-amber-200/60",
    linha: "bg-white/[0.035] ring-1 ring-amber-300/15",
    destaque: "bg-gradient-to-r from-amber-300 via-yellow-400 to-amber-500 text-black shadow-[0_0_26px_rgba(251,191,36,0.5)]",
    destaqueSub: "text-black/70",
    preco: "text-white",
    rotulo: "text-amber-200/70",
    selo: "bg-gradient-to-r from-amber-300 to-yellow-500 text-black font-bold",
    descricao: "text-amber-50/80 italic",
    desconto: "bg-amber-400/15 text-amber-300",
    desconto_dest: "bg-black/15 text-black",
  },
};

export interface DadosCardapio {
  nome: string;
  categoria: string | null;
  foto_url: string | null;
  estoque_dg: number;
  faixas: TabelaPreco;
  estilo: EstiloMenu;
  destaqueDg: number | null;
  selo: string | null;
  descricao: string | null;
}

function precoCurto(cents: number) {
  // "R$ 95" quando é redondo; "R$ 92,50" quando tem centavos.
  return cents % 100 === 0 ? `R$ ${(cents / 100).toLocaleString("pt-BR")}` : formatBRL(cents);
}

/** Card de um produto no cardápio: uma linha por faixa (preço/g, a partir de, total e % de desconto). */
export function CardCardapio({ d, mostrarEstoque, children }: { d: DadosCardapio; mostrarEstoque: boolean; children?: React.ReactNode }) {
  const e = ESTILO[d.estilo];
  const faixas = ordenarFaixas(d.faixas);

  return (
    <article className={e.moldura}>
      <div className={cn("p-4 sm:p-5", e.corpo)}>
        <header className="mb-4 flex items-center gap-3">
          {d.foto_url && (
            // eslint-disable-next-line @next/next/no-img-element -- URL assinada temporária
            <img
              src={d.foto_url}
              alt=""
              className={cn("size-14 shrink-0 rounded-xl object-cover", d.estilo === "premium" && "ring-2 ring-amber-400/70")}
            />
          )}
          <div className="min-w-0 flex-1">
            <h3 className={cn("truncate text-2xl font-black tracking-tight", e.nome)}>{d.nome}</h3>
            <p className={cn("text-xs", e.sub)}>
              {[d.categoria, mostrarEstoque && d.estoque_dg > 0 ? `${formatGrams(d.estoque_dg)} disponíveis` : null]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </div>
          {d.selo && (
            <span className={cn("shrink-0 rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-wider", e.selo)}>
              {d.selo}
            </span>
          )}
        </header>

        {d.descricao && (
          <p className={cn("-mt-1 mb-4 whitespace-pre-line text-sm leading-relaxed", e.descricao)}>{d.descricao}</p>
        )}

        <ul className="space-y-1.5">
          {faixas.map((f) => {
            const dest = d.destaqueDg === f.minDg;
            const desc = descontoDaFaixaBps(faixas, f);
            return (
              <li
                key={f.minDg}
                className={cn("flex items-center gap-3 rounded-xl px-3 py-2.5", dest ? cn(e.destaque, "scale-[1.02]") : e.linha)}
              >
                <span className={cn("min-w-[5.5rem] text-3xl font-black tabular-nums leading-none sm:text-4xl", dest ? "" : e.preco)}>
                  {precoCurto(f.precoCents)}
                </span>
                <span className="flex-1 leading-tight">
                  <span className={cn("block text-[11px] font-semibold", dest ? e.destaqueSub : e.rotulo)}>a grama</span>
                  <span className={cn("block text-sm font-bold", dest ? "" : e.preco)}>
                    a partir de {formatGrams(f.minDg)}
                  </span>
                </span>
                <span className="text-right leading-tight">
                  <span className={cn("block text-sm font-semibold tabular-nums", dest ? "" : e.preco)}>
                    {formatGrams(f.minDg)} = {formatBRL(priceFor(f.minDg, f.precoCents))}
                  </span>
                  {desc > 0 && (
                    <span className={cn("mt-0.5 inline-block rounded-full px-1.5 py-0.5 text-[10px] font-bold", dest ? e.desconto_dest : e.desconto)}>
                      −{formatBps(desc)}
                    </span>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
        {children}
      </div>
    </article>
  );
}
