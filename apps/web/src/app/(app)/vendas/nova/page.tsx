import type { Metadata } from "next";
import { Suspense } from "react";
import { Cabecalho } from "@/components/ui/pagina";
import { listarPessoas } from "@/modules/pessoas/dados";
import { listarProdutos } from "@/modules/produtos/dados";
import { NovaVenda } from "@/modules/vendas/componentes/nova-venda";

export const metadata: Metadata = { title: "Nova venda" };

async function Form() {
  const [produtos, clientes] = await Promise.all([listarProdutos(), listarPessoas("clientes")]);
  return <NovaVenda produtos={produtos} clientes={clientes} />;
}

export default function NovaVendaPage() {
  return (
    <div className="mx-auto max-w-5xl">
      <Cabecalho titulo="Nova venda" voltar="/vendas" />
      <Suspense fallback={<div className="h-64 animate-pulse rounded-xl border border-line bg-card" />}>
        <Form />
      </Suspense>
    </div>
  );
}
