import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Plus } from "lucide-react";
import { Cabecalho, Carregando, linkBotao } from "@/components/ui/pagina";
import { listarProdutos } from "@/modules/produtos/dados";
import { ListaProdutos } from "@/modules/produtos/componentes/lista";

export const metadata: Metadata = { title: "Produtos" };

async function Lista() {
  const produtos = await listarProdutos();
  if (!produtos.length)
    return (
      <div className="rounded-xl border border-dashed border-line p-10 text-center">
        <p className="font-medium">Nenhum produto ainda</p>
        <p className="mb-4 text-sm text-muted">Cadastre o primeiro e depois dê entrada no estoque.</p>
        <Link href="/produtos/novo" className={linkBotao}>
          <Plus size={16} /> Novo produto
        </Link>
      </div>
    );
  return <ListaProdutos produtos={produtos} />;
}

export default function ProdutosPage() {
  return (
    <div className="mx-auto max-w-6xl">
      <Cabecalho
        titulo="Produtos"
        sub="Estoque em gramas, níveis de alerta e custo real por lote."
        acoes={
          <Link href="/produtos/novo" className={linkBotao}>
            <Plus size={16} /> Novo
          </Link>
        }
      />
      <Suspense fallback={<Carregando />}>
        <Lista />
      </Suspense>
    </div>
  );
}
