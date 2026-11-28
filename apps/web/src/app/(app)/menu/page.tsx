import type { Metadata } from "next";
import { Suspense } from "react";
import { Cabecalho, Carregando } from "@/components/ui/pagina";
import { listarProdutos } from "@/modules/produtos/dados";
import { lerPrefsMenu, listarDescricoes } from "@/modules/menu/dados";
import { Catalogo } from "@/modules/menu/componentes/catalogo";

export const metadata: Metadata = { title: "Menu" };

async function Conteudo() {
  const [produtos, prefs, descricoes] = await Promise.all([listarProdutos(), lerPrefsMenu(), listarDescricoes()]);
  return <Catalogo produtos={produtos} prefs={prefs} descricoes={descricoes} />;
}

export default function MenuPage() {
  return (
    <div className="mx-auto max-w-5xl">
      <Cabecalho titulo="Menu" sub="Seu cardápio para mostrar aos clientes. Personalize e compartilhe como imagem." />
      <Suspense fallback={<Carregando linhas={1} />}>
        <Conteudo />
      </Suspense>
    </div>
  );
}
