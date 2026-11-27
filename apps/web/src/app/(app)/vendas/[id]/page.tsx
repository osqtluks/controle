import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { formatBps, formatBRL, formatGrams, formatLucro } from "@ct/core";
import { Cabecalho, Secao } from "@/components/ui/pagina";
import { cn } from "@/lib/cn";
import { formatData, formatDataHora } from "@/lib/datas";
import { obterVenda } from "@/modules/vendas/dados";
import { BotaoCancelarVenda, BotaoReativarVenda } from "@/modules/vendas/componentes/botoes-venda";
import { descreverDesconto, ROTULO_FAIXA } from "@/modules/vendas/tipos";

export const metadata: Metadata = { title: "Venda" };

async function Detalhe({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const v = await obterVenda(id);
  if (!v) notFound();
  const lucro = v.total_cents - v.custo_cents;
  const margem = v.total_cents > 0 ? Math.round((lucro * 10000) / v.total_cents) : null;

  return (
    <>
      <Cabecalho
        titulo={`Venda #${v.numero}`}
        sub={`${formatDataHora(v.data)}${v.cliente ? ` · ${v.cliente.nome}` : ""}`}
        voltar="/vendas"
        acoes={!v.cancelada_em && <BotaoCancelarVenda id={v.id} numero={v.numero} />}
      />

      {v.cancelada_em && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3">
          <p className="text-sm text-red-300">
            Cancelada em {formatDataHora(v.cancelada_em)}. As gramas voltaram para o estoque.
          </p>
          <BotaoReativarVenda id={v.id} />
        </div>
      )}

      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          ["Total", formatBRL(v.total_cents), ""],
          ["Custo real", formatBRL(v.custo_cents), "text-muted"],
          ["Lucro", formatLucro(lucro), lucro < 0 ? "text-red-400" : "text-emerald-400"],
          ["Margem", margem !== null ? formatBps(margem) : "—", ""],
        ].map(([r, val, cor]) => (
          <div key={r} className="rounded-xl border border-line bg-card p-3">
            <div className="text-[11px] text-faint">{r}</div>
            <div className={cn("text-lg font-semibold tabular-nums", cor)}>{val}</div>
          </div>
        ))}
      </div>

      <Secao titulo="Itens">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="border-b border-line text-left text-xs uppercase tracking-wide text-faint">
              <tr>
                <th className="px-2 py-2">Produto</th>
                <th className="px-2 py-2">Qtd.</th>
                <th className="px-2 py-2">Faixa</th>
                <th className="px-2 py-2">Desconto</th>
                <th className="px-2 py-2 text-right">Total</th>
                <th className="px-2 py-2 text-right">Custo</th>
                <th className="px-2 py-2 text-right">Lucro</th>
              </tr>
            </thead>
            <tbody>
              {v.itens.map((i) => {
                const l = i.total_cents - i.custo_cents;
                return (
                  <tr key={i.id} className="border-b border-line/60 last:border-0">
                    <td className="px-2 py-2">
                      <Link href={`/produtos/${i.produto_id}`} className="hover:underline">
                        {i.produto?.nome}
                      </Link>
                    </td>
                    <td className="px-2 py-2 tabular-nums">{formatGrams(i.quantidade_dg)}</td>
                    <td className="px-2 py-2 text-xs">
                      {ROTULO_FAIXA[i.faixa]} · {formatBRL(i.preco_lista_cents_por_grama)}/g
                    </td>
                    <td className="px-2 py-2 text-xs text-orange-300">
                      {i.desconto_cents > 0 ? `${descreverDesconto(i.desconto_tipo, i.desconto_valor)} (−${formatBRL(i.desconto_cents)})` : "—"}
                    </td>
                    <td className="px-2 py-2 text-right font-medium tabular-nums">{formatBRL(i.total_cents)}</td>
                    <td className="px-2 py-2 text-right tabular-nums text-muted">{formatBRL(i.custo_cents)}</td>
                    <td className={cn("px-2 py-2 text-right tabular-nums", l < 0 ? "text-red-400" : "text-emerald-400")}>
                      {formatLucro(l)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Secao>

      <div className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
        <div className="rounded-xl border border-line bg-card p-3">
          <div className="text-[11px] text-faint">Pagamento</div>
          {v.pagamento === "fiado" ? (
            <span className="text-orange-300">Fiado{v.vencimento ? ` · combinado para ${formatData(v.vencimento)}` : ""}</span>
          ) : (
            <span className="text-emerald-300">Recebido na hora</span>
          )}
        </div>
        {v.observacoes && (
          <div className="rounded-xl border border-line bg-card p-3">
            <div className="text-[11px] text-faint">Observações</div>
            <p className="whitespace-pre-line">{v.observacoes}</p>
          </div>
        )}
      </div>
    </>
  );
}

export default function VendaPage({ params }: PageProps<"/vendas/[id]">) {
  return (
    <div className="mx-auto max-w-5xl">
      <Suspense fallback={<div className="h-64 animate-pulse rounded-xl border border-line bg-card" />}>
        <Detalhe params={params} />
      </Suspense>
    </div>
  );
}
