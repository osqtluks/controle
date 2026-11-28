import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { bonusIndicacao, brindeDoMes, descreverBonus, rankingIndicacoes } from "@ct/core";
import { Cabecalho } from "@/components/ui/pagina";
import { hojeISO } from "@/lib/datas";
import { dadosIndicacoes } from "@/modules/pessoas/dados";
import { descreverHorario } from "@/modules/pessoas/tipos";
import { listarProdutos, lotesDisponiveis } from "@/modules/produtos/dados";
import { NovaVenda } from "@/modules/vendas/componentes/nova-venda";
import type { InfoCliente } from "@/modules/vendas/tipos";

export const metadata: Metadata = { title: "Nova venda" };

async function Form({ searchParams }: { searchParams: Promise<{ cliente?: string }> }) {
  await connection();
  const hoje = hojeISO();
  const [produtos, ind, lotes, sp] = await Promise.all([listarProdutos(), dadosIndicacoes(), lotesDisponiveis(), searchParams]);
  const clientes = ind.pessoas.filter((p) => p.tipo !== "fornecedor");
  const top = new Set(
    rankingIndicacoes(ind.base, ind.vendas, hoje)
      .filter((l) => l.posicao !== null && l.posicao <= 3)
      .map((l) => l.id),
  );

  const info: Record<string, InfoCliente> = {};
  for (const p of clientes) {
    const b = top.has(p.id) ? bonusIndicacao(p.id, ind.base, ind.vendas, hoje) : null;
    const br = brindeDoMes(ind.compras.get(p.id) ?? [], hoje);
    info[p.id] = {
      bonusBps: b?.totalBps ?? 0,
      bonusTexto: b ? descreverBonus(b) : "",
      comprasNoMes: br.comprasNoMes,
      brindeGanho: br.ganhou,
      brindeEntregue: br.entregue,
      horarios: p.horarios_entrega.map(descreverHorario),
      endereco: p.endereco,
    };
  }
  const inicial = sp.cliente && clientes.some((c) => c.id === sp.cliente) ? sp.cliente : null;

  return (
    <NovaVenda
      produtos={produtos}
      clientes={clientes.map((c) => ({ id: c.id, nome: c.nome }))}
      lotes={lotes}
      infoClientes={info}
      clienteInicial={inicial}
    />
  );
}

export default function NovaVendaPage({ searchParams }: PageProps<"/vendas/nova">) {
  return (
    <div className="mx-auto max-w-5xl">
      <Cabecalho titulo="Nova venda" voltar="/vendas" />
      <Suspense fallback={<div className="h-64 animate-pulse rounded-xl border border-line bg-card" />}>
        <Form searchParams={searchParams as Promise<{ cliente?: string }>} />
      </Suspense>
    </div>
  );
}
