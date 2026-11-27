import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ImageOff, Pencil } from "lucide-react";
import { custoPorGrama, formatBRL, formatBps, formatGrams, margemBps, priceFor } from "@ct/core";
import { StockBar } from "@/components/stock-bar";
import { Cabecalho, Secao, linkBotaoSec } from "@/components/ui/pagina";
import { formatData } from "@/lib/datas";
import { listarPessoas } from "@/modules/pessoas/dados";
import { historicoDe, listarLotes, obterProduto } from "@/modules/produtos/dados";
import { SeloVencimento } from "@/modules/produtos/componentes/card";
import { FormEntrada } from "@/modules/produtos/componentes/form-entrada";
import { Historico } from "@/modules/produtos/componentes/historico";
import { TabelaLotes } from "@/modules/produtos/componentes/tabela-lotes";
import { BotaoArquivar } from "@/modules/produtos/componentes/botao-arquivar";
import { limitesDe } from "@/modules/produtos/tipos";

export const metadata: Metadata = { title: "Produto" };

function Numero({ rotulo, valor, sub }: { rotulo: string; valor: string; sub?: string }) {
  return (
    <div className="rounded-lg bg-bg/60 p-3">
      <div className="text-[11px] text-faint">{rotulo}</div>
      <div className="text-lg font-semibold tabular-nums">{valor}</div>
      {sub && <div className="text-[11px] text-muted">{sub}</div>}
    </div>
  );
}

async function Detalhe({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const p = await obterProduto(id);
  if (!p) notFound();
  const [lotes, fornecedores] = await Promise.all([listarLotes(id), listarPessoas("fornecedores")]);
  const eventos = await historicoDe([id, ...lotes.map((l) => l.id)]);

  const custoG = custoPorGrama(p.custo_estoque_cents, p.estoque_dg);
  const margem = custoG !== null ? margemBps(p.preco_cents_por_grama, custoG) : null;
  const lim = limitesDe(p);

  return (
    <>
      <Cabecalho
        titulo={p.nome}
        sub={[p.categoria, p.arquivado ? "arquivado" : null].filter(Boolean).join(" · ") || "Sem categoria"}
        voltar="/produtos"
        acoes={
          <>
            <BotaoArquivar id={p.id} arquivado={p.arquivado} />
            <Link href={`/produtos/${p.id}/editar`} className={linkBotaoSec}>
              <Pencil size={15} /> Editar
            </Link>
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
        <div className="space-y-4">
          <section className="rounded-xl border border-line bg-card p-4">
            <div className="flex gap-4">
              <div className="size-24 shrink-0 overflow-hidden rounded-xl bg-hover sm:size-32">
                {p.foto_url ? (
                  // eslint-disable-next-line @next/next/no-img-element -- URL assinada temporária
                  <img src={p.foto_url} alt={p.nome} className="size-full object-cover" />
                ) : (
                  <div className="flex size-full items-center justify-center text-faint">
                    <ImageOff />
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1 space-y-3">
                <StockBar qty={p.estoque_dg} limites={lim} />
                <div className="flex flex-wrap gap-1.5 text-[11px] text-muted">
                  <span>Cheio {formatGrams(lim.cheio)}</span>·<span>Metade {formatGrams(lim.metade)}</span>·
                  <span>Fim {formatGrams(lim.acabando)}</span>·<span>Muito baixo {formatGrams(lim.muitoBaixo)}</span>·
                  <span>Acabou {formatGrams(lim.acabou)}</span>
                </div>
                <SeloVencimento data={p.proximo_vencimento} />
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Numero rotulo="Preço de venda" valor={`${formatBRL(p.preco_cents_por_grama)}/g`} />
              <Numero rotulo="Custo médio" valor={custoG !== null ? `${formatBRL(custoG)}/g` : "—"} sub="do que está em estoque" />
              <Numero rotulo="Margem" valor={margem !== null ? formatBps(margem) : "—"} />
              <Numero
                rotulo="Estoque vale"
                valor={formatBRL(priceFor(p.estoque_dg, p.preco_cents_por_grama))}
                sub={`custou ${formatBRL(p.custo_estoque_cents)}`}
              />
            </div>
            {(p.descricao || p.observacoes) && (
              <div className="mt-4 space-y-2 text-sm">
                {p.descricao && <p className="whitespace-pre-line">{p.descricao}</p>}
                {p.observacoes && <p className="whitespace-pre-line text-muted">Obs.: {p.observacoes}</p>}
              </div>
            )}
            <p className="mt-3 text-[11px] text-faint">Última entrada: {formatData(p.ultima_entrada)}</p>
          </section>

          <Secao titulo={`Entradas (${lotes.length})`}>
            <TabelaLotes lotes={lotes} />
          </Secao>

          <Secao titulo="Histórico de alterações">
            <Historico eventos={eventos} />
          </Secao>
        </div>

        <aside className="lg:sticky lg:top-6 lg:self-start">
          <Secao titulo="Dar entrada no estoque">
            <FormEntrada produtoId={p.id} fornecedores={fornecedores} />
          </Secao>
        </aside>
      </div>
    </>
  );
}

export default function ProdutoPage({ params }: PageProps<"/produtos/[id]">) {
  return (
    <div className="mx-auto max-w-6xl">
      <Suspense fallback={<div className="h-96 animate-pulse rounded-xl border border-line bg-card" />}>
        <Detalhe params={params} />
      </Suspense>
    </div>
  );
}
