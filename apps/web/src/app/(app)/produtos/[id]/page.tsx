import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ImageOff, Pencil } from "lucide-react";
import { formatGrams } from "@ct/core";
import { StockBar } from "@/components/stock-bar";
import { Cabecalho, Secao, linkBotaoSec } from "@/components/ui/pagina";
import { formatData } from "@/lib/datas";
import { listarPessoas } from "@/modules/pessoas/dados";
import { historicoDe, listarLotes, obterProduto } from "@/modules/produtos/dados";
import { SeloVencimento } from "@/modules/produtos/componentes/card";
import { FormEntrada } from "@/modules/produtos/componentes/form-entrada";
import { Historico } from "@/modules/produtos/componentes/historico";
import { TabelaLotes } from "@/modules/produtos/componentes/tabela-lotes";
import { FornecedorProduto } from "@/modules/produtos/componentes/fornecedor-produto";
import { DesempenhoBloco } from "@/modules/vendas/componentes/desempenho-produto";
import { desempenhoDosProdutos } from "@/modules/vendas/dados";
import { EditarPrecos } from "@/modules/produtos/componentes/editar-precos";
import { AcoesLixeira } from "@/modules/produtos/componentes/botoes-lixeira";
import { limitesDe, tabelaDe } from "@/modules/produtos/tipos";

export const metadata: Metadata = { title: "Produto" };

async function Detalhe({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const p = await obterProduto(id);
  if (!p) notFound();
  const [lotes, fornecedores, desemp] = await Promise.all([
    listarLotes(id),
    listarPessoas("fornecedores"),
    desempenhoDosProdutos(),
  ]);
  const eventos = await historicoDe([id, ...lotes.map((l) => l.id)]);

  const lim = limitesDe(p);

  return (
    <>
      <Cabecalho
        titulo={p.nome}
        sub={p.categoria ?? "Sem categoria"}
        voltar="/produtos"
        acoes={
          <>
            <Link href={`/produtos/${p.id}/editar`} className={linkBotaoSec}>
              <Pencil size={15} /> Editar
            </Link>
          </>
        }
      />

      {p.arquivado && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3">
          <p className="text-sm text-red-300">Este produto está na Lixeira e não aparece nas listas.</p>
          <AcoesLixeira id={p.id} nome={p.nome} voltarPara="/produtos" />
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="min-w-0 space-y-4">
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
                <FornecedorProduto produtoId={p.id} valor={p.fornecedor_id} fornecedores={fornecedores} />
                <SeloVencimento data={p.proximo_vencimento} />
              </div>
            </div>
            <div className="mt-4">
              <EditarPrecos id={p.id} tabela={tabelaDe(p)} custo={p.custo_ref_cents_por_grama} />
            </div>
            <div className="mt-2">
              <DesempenhoBloco d={desemp.get(p.id)} estoqueDg={p.estoque_dg} tabela={tabelaDe(p)} />
            </div>
            {(p.descricao || p.observacoes) && (
              <div className="mt-4 space-y-2 text-sm">
                {p.descricao && <p className="whitespace-pre-line">{p.descricao}</p>}
                {p.observacoes && <p className="whitespace-pre-line text-muted">Obs.: {p.observacoes}</p>}
              </div>
            )}
            <p className="mt-3 text-[11px] text-faint">Última entrada: {formatData(p.ultima_entrada)}</p>

            <div className="mt-4 border-t border-line pt-3">
              <h3 className="mb-1 text-xs font-medium uppercase tracking-wide text-muted">Histórico de alterações</h3>
              <Historico eventos={eventos} nomes={Object.fromEntries(fornecedores.map((f) => [f.id, f.nome]))} />
            </div>
          </section>

          <Secao titulo={`Entradas (${lotes.length})`}>
            <TabelaLotes lotes={lotes} fornecedores={fornecedores} />
          </Secao>
        </div>

        <aside className="lg:sticky lg:top-6 lg:self-start">
          <Secao titulo="Dar entrada no estoque">
            <FormEntrada produtoId={p.id} fornecedores={fornecedores} custoRef={p.custo_ref_cents_por_grama} fornecedorPadrao={p.fornecedor_id} />
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
