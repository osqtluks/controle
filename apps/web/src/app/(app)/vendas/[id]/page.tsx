import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { bonusIndicacao, formatBps, formatBRL, formatGrams, formatLucro, mensagensPosVenda } from "@ct/core";
import { connection } from "next/server";
import { MensagemPronta } from "@/components/ui/copiar";
import { hojeISO } from "@/lib/datas";
import { dadosIndicacoes } from "@/modules/pessoas/dados";
import { Cabecalho, Secao } from "@/components/ui/pagina";
import { cn } from "@/lib/cn";
import { formatData, formatDataHora } from "@/lib/datas";
import { obterVenda } from "@/modules/vendas/dados";
import { contaDaVenda } from "@/modules/contas/dados";
import { BotaoCancelarVenda, BotaoReativarVenda } from "@/modules/vendas/componentes/botoes-venda";
import { descreverDesconto, rotuloDaFaixa } from "@/modules/vendas/tipos";

export const metadata: Metadata = { title: "Venda" };

/** Depois da venda: cruza compras do mês, brinde e indicações e monta mensagens para copiar. */
async function Mensagens({ vendaId, clienteId }: { vendaId: string; clienteId: string }) {
  await connection();
  const hoje = hojeISO();
  const { pessoas, base, vendas, compras } = await dadosIndicacoes();
  const cliente = pessoas.find((p) => p.id === clienteId);
  if (!cliente) return null;
  const ind = cliente.indicado_por ? pessoas.find((p) => p.id === cliente.indicado_por) : null;
  const ms = mensagensPosVenda({
    cliente: { nome: cliente.nome, telefone: cliente.telefone },
    compras: compras.get(clienteId) ?? [],
    vendaId,
    hoje,
    bonusCliente: bonusIndicacao(clienteId, base, vendas, hoje),
    indicador: ind ? { nome: ind.nome, telefone: ind.telefone, bonus: bonusIndicacao(ind.id, base, vendas, hoje) } : null,
  });
  if (!ms.length) return null;
  return (
    <div className="mb-4 grid gap-2 md:grid-cols-2">
      {ms.map((m) => (
        <MensagemPronta key={m.titulo} titulo={m.titulo} texto={m.texto} telefone={m.telefone} />
      ))}
    </div>
  );
}

async function Detalhe({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const v = await obterVenda(id);
  if (!v) notFound();
  const conta = v.pagamento === "fiado" ? await contaDaVenda(v.id) : null;
  const lucro = v.total_cents - v.custo_cents;
  const margem = v.total_cents > 0 ? Math.round((lucro * 10000) / v.total_cents) : null;

  return (
    <>
      <Cabecalho
        titulo={`${v.brinde ? "Brinde" : "Venda"} #${v.numero}`}
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

      {!v.cancelada_em && !v.brinde && v.cliente_id && (
        <Suspense fallback={null}>
          <Mensagens vendaId={v.id} clienteId={v.cliente_id} />
        </Suspense>
      )}

      {v.brinde ? (
        <div className="mb-4 rounded-xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
          🎁 Brinde{v.cliente ? ` para ${v.cliente.nome}` : ""}: {formatGrams(v.itens.reduce((s, i) => s + i.quantidade_dg, 0))} saíram do
          estoque sem valor. Não entra em faturamento nem lucro.
          <span className="mt-1 block text-xs text-amber-200/70">Custo dessas gramas no estoque: {formatBRL(v.custo_cents)} (só informativo).</span>
        </div>
      ) : (
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
      )}

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
                const liquido = i.total_cents - i.desconto_geral_cents;
                const l = liquido - i.custo_cents;
                return (
                  <tr key={i.id} className="border-b border-line/60 last:border-0">
                    <td className="px-2 py-2">
                      <Link href={`/produtos/${i.produto_id}`} className="hover:underline">
                        {i.produto?.nome}
                      </Link>
                    </td>
                    <td className="px-2 py-2 tabular-nums">{formatGrams(i.quantidade_dg)}</td>
                    <td className="px-2 py-2 text-xs">
                      {rotuloDaFaixa(i.faixa)} · {formatBRL(i.preco_lista_cents_por_grama)}/g
                    </td>
                    <td className="px-2 py-2 text-xs text-orange-300">
                      {i.desconto_cents > 0 ? `${descreverDesconto(i.desconto_tipo, i.desconto_valor)} (−${formatBRL(i.desconto_cents)})` : "—"}
                      {i.desconto_geral_cents > 0 && <div>geral −{formatBRL(i.desconto_geral_cents)}</div>}
                    </td>
                    <td className="px-2 py-2 text-right font-medium tabular-nums">{formatBRL(liquido)}</td>
                    <td className="px-2 py-2 text-right tabular-nums text-muted">{formatBRL(i.custo_cents)}</td>
                    <td className={cn("px-2 py-2 text-right tabular-nums", l < 0 ? "text-red-400" : "text-emerald-400")}>
                      {v.brinde ? <span className="text-faint">—</span> : formatLucro(l)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Secao>

      {(v.desconto_cents > 0 || v.desconto_geral_cents > 0) && (
        <div className="mt-4 space-y-1 rounded-xl border border-line bg-card p-3 text-sm">
          <div className="flex justify-between text-xs">
            <span className="text-faint">Subtotal (preço de tabela)</span>
            <span className="tabular-nums text-muted">{formatBRL(v.subtotal_cents)}</span>
          </div>
          {v.itens
            .filter((i) => i.desconto_cents > 0)
            .map((i) => (
              <div key={i.id} className="flex justify-between text-xs text-orange-300">
                <span>
                  {descreverDesconto(i.desconto_tipo, i.desconto_valor)} em {i.produto?.nome}
                </span>
                <span className="tabular-nums">−{formatBRL(i.desconto_cents)}</span>
              </div>
            ))}
          {v.desconto_geral_cents > 0 && (
            <div className="flex justify-between text-xs text-orange-300">
              <span>
                {v.desconto_geral_tipo === "cupom"
                  ? `cupom ${v.cupom_codigo} (${(v.desconto_geral_bps / 100).toLocaleString("pt-BR")}%)`
                  : `${(v.desconto_geral_bps / 100).toLocaleString("pt-BR")}% na venda toda${v.desconto_geral_motivo ? ` (${v.desconto_geral_motivo})` : ""}`}
              </span>
              <span className="tabular-nums">−{formatBRL(v.desconto_geral_cents)}</span>
            </div>
          )}
          <div className="flex justify-between border-t border-line/60 pt-1 font-semibold">
            <span>Total</span>
            <span className="tabular-nums">{formatBRL(v.total_cents)}</span>
          </div>
        </div>
      )}

      <div className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
        <div className="rounded-xl border border-line bg-card p-3">
          <div className="text-[11px] text-faint">Pagamento</div>
          {v.brinde ? (
            <span className="text-amber-300">Brinde, sem pagamento</span>
          ) : v.pagamento === "fiado" ? (
            <>
              <span className="text-orange-300">Fiado{v.vencimento ? ` · combinado para ${formatData(v.vencimento)}` : ""}</span>
              {conta && (
                <Link href={`/contas/${conta.id}`} className="mt-1 block text-accent hover:underline">
                  {conta.restante_cents > 0
                    ? `Falta receber ${formatBRL(conta.restante_cents)}${conta.pago_cents > 0 ? ` (já recebeu ${formatBRL(conta.pago_cents)})` : ""} →`
                    : "Quitada ✓ — ver conta →"}
                </Link>
              )}
            </>
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
