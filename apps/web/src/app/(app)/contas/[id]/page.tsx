import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { connection } from "next/server";
import { diasEntre, formatBRL, situacaoDe } from "@ct/core";
import { Cabecalho, Secao } from "@/components/ui/pagina";
import { cn } from "@/lib/cn";
import { formatData, formatDataHora, hojeISO } from "@/lib/datas";
import { obterConta } from "@/modules/contas/dados";
import { SeloSituacao } from "@/modules/contas/componentes/lista-contas";
import { HistoricoConta } from "@/modules/contas/componentes/historico-conta";
import {
  BotaoCancelarConta,
  BotaoEstorno,
  BotaoReativarConta,
  FormPagamento,
  Remarcar,
} from "@/modules/contas/componentes/acoes-conta";
import { FORMAS } from "@/modules/contas/tipos";

export const metadata: Metadata = { title: "Conta" };

async function Detalhe({ params }: { params: Promise<{ id: string }> }) {
  await connection();
  const { id } = await params;
  const r = await obterConta(id);
  if (!r) notFound();
  const { conta: c, parcelas, pagamentos, eventos } = r;
  const hoje = hojeISO();
  const info = situacaoDe(c.restante_cents, c.proximo_vencimento, hoje, undefined, !!c.cancelada_em);
  const receber = c.tipo === "receber";

  return (
    <>
      <Cabecalho
        titulo={`${c.pessoa?.nome ?? "Sem pessoa"} · ${c.descricao}`}
        sub={
          <span className="inline-flex flex-wrap items-center gap-2">
            <span className={receber ? "text-emerald-400" : "text-sky-300"}>{receber ? "Me deve" : "Eu devo"}</span>· Conta #{c.numero}
            <SeloSituacao info={info} />
          </span>
        }
        voltar="/contas"
        acoes={!c.cancelada_em && <BotaoCancelarConta id={c.id} numero={c.numero} />}
      />

      {c.cancelada_em && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3">
          <p className="text-sm text-red-300">Cancelada em {formatDataHora(c.cancelada_em)}. Não aparece nas pendências.</p>
          {c.origem !== "venda" && <BotaoReativarConta id={c.id} />}
          {c.origem === "venda" && <span className="text-xs text-muted">Reative pela venda.</span>}
        </div>
      )}

      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          ["Total", formatBRL(c.valor_total_cents), ""],
          [receber ? "Recebido" : "Pago", formatBRL(c.pago_cents), "text-emerald-400"],
          ["Falta", formatBRL(c.restante_cents), c.restante_cents > 0 ? (info.situacao === "atrasada" ? "text-red-400" : "") : "text-sky-300"],
          ["Idade da dívida", `${diasEntre(c.created_at.slice(0, 10), hoje)} dias`, "text-muted"],
        ].map(([rot, val, cor]) => (
          <div key={rot} className="rounded-xl border border-line bg-card p-3">
            <div className="text-[11px] text-faint">{rot}</div>
            <div className={cn("text-lg font-semibold tabular-nums", cor)}>{val}</div>
          </div>
        ))}
      </div>

      {(c.venda_id || c.lote_id || c.observacoes) && (
        <div className="mb-4 rounded-xl border border-line bg-card p-3 text-sm">
          {c.venda_id && (
            <Link href={`/vendas/${c.venda_id}`} className="text-accent hover:underline">
              Ver a venda de origem →
            </Link>
          )}
          {c.origem === "compra" && <span className="text-muted">Criada por uma compra a prazo.</span>}
          {c.observacoes && <p className="mt-1 whitespace-pre-line text-muted">{c.observacoes}</p>}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-4">
          <Secao titulo={parcelas.length > 1 ? `Parcelas (${c.parcelas_pagas}/${parcelas.length} pagas)` : "Vencimento"}>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[620px] text-sm">
                <thead className="border-b border-line text-left text-[11px] uppercase tracking-wide text-faint">
                  <tr>
                    <th className="px-2 py-2">Nº</th>
                    <th className="px-2 py-2">Valor</th>
                    <th className="px-2 py-2">Falta</th>
                    <th className="px-2 py-2">Vencimento</th>
                    <th className="px-2 py-2">Remarcada</th>
                    <th className="px-2 py-2">Situação</th>
                    <th className="px-2 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {parcelas.map((p) => {
                    const ip = situacaoDe(p.restante_cents, p.vencimento_atual, hoje, undefined, !!c.cancelada_em);
                    return (
                      <tr key={p.id} className="border-b border-line/60 align-top last:border-0">
                        <td className="px-2 py-2 text-muted">{p.numero}ª</td>
                        <td className="whitespace-nowrap px-2 py-2 tabular-nums">{formatBRL(p.valor_cents)}</td>
                        <td className="whitespace-nowrap px-2 py-2 font-medium tabular-nums">{formatBRL(p.restante_cents)}</td>
                        <td className="whitespace-nowrap px-2 py-2 tabular-nums">
                          {formatData(p.vencimento_atual)}
                          {p.dias_remarcados !== 0 && (
                            <div className="text-[11px] text-faint">
                              original <span className="line-through">{formatData(p.vencimento_original)}</span>
                            </div>
                          )}
                        </td>
                        <td className="px-2 py-2">
                          {p.dias_remarcados > 0 ? (
                            <span className="rounded-full bg-violet-500/15 px-2 py-0.5 text-[11px] font-medium text-violet-300">
                              +{p.dias_remarcados} dias
                            </span>
                          ) : p.dias_remarcados < 0 ? (
                            <span className="text-[11px] text-muted">{p.dias_remarcados} dias</span>
                          ) : (
                            <span className="text-faint">—</span>
                          )}
                        </td>
                        <td className="px-2 py-2">
                          <SeloSituacao info={ip} />
                        </td>
                        <td className="px-2 py-2 text-right">{p.restante_cents > 0 && !c.cancelada_em && <Remarcar parcela={p} />}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Secao>

          <Secao titulo={receber ? "Recebimentos" : "Pagamentos"}>
            {pagamentos.length === 0 ? (
              <p className="text-sm text-muted">Nenhum ainda.</p>
            ) : (
              <ul className="divide-y divide-line/60">
                {pagamentos.map((p) => (
                  <li key={p.id} className={cn("flex items-center justify-between gap-3 py-2 text-sm", p.estornado_em && "opacity-50")}>
                    <div>
                      <span className={cn("font-semibold tabular-nums", p.estornado_em ? "line-through" : "text-emerald-400")}>
                        {formatBRL(p.valor_cents)}
                      </span>{" "}
                      <span className="text-muted">
                        · {FORMAS[p.forma]} · {formatData(p.data)}
                      </span>
                      {p.observacao && <div className="text-[11px] text-muted">{p.observacao}</div>}
                      {p.estornado_em && <div className="text-[11px] text-red-400">estornado em {formatDataHora(p.estornado_em)}</div>}
                    </div>
                    {!c.cancelada_em && <BotaoEstorno p={p} />}
                  </li>
                ))}
              </ul>
            )}
          </Secao>

          <Secao titulo="Histórico">
            <HistoricoConta eventos={eventos} tipo={c.tipo} />
          </Secao>
        </div>

        {!c.cancelada_em && (
          <aside className="lg:sticky lg:top-6 lg:self-start">
            <Secao titulo={receber ? "Registrar recebimento" : "Registrar pagamento"}>
              <FormPagamento contaId={c.id} tipo={c.tipo} parcelas={parcelas} />
            </Secao>
          </aside>
        )}
      </div>
    </>
  );
}

export default function ContaPage({ params }: PageProps<"/contas/[id]">) {
  return (
    <div className="mx-auto max-w-6xl">
      <Suspense fallback={<div className="h-64 animate-pulse rounded-xl border border-line bg-card" />}>
        <Detalhe params={params} />
      </Suspense>
    </div>
  );
}
