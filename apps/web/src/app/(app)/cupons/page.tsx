import type { Metadata } from "next";
import { Suspense } from "react";
import { connection } from "next/server";
import { hojeISO } from "@/lib/datas";
import { Cabecalho, Carregando, Secao } from "@/components/ui/pagina";
import { listarCupons } from "@/modules/cupons/dados";
import { FormCupom, ListaCupons } from "@/modules/cupons/componentes/cupons";

export const metadata: Metadata = { title: "Cupons" };

async function Form() {
  await connection(); // "hoje" é da hora da requisição
  return <FormCupom hoje={hojeISO()} />;
}

async function Lista() {
  return <ListaCupons cupons={await listarCupons()} />;
}

export default function CuponsPage() {
  return (
    <div className="mx-auto max-w-6xl">
      <Cabecalho titulo="Cupons" sub="Uma % de desconto com nome. Toque no código para copiar e mandar." />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0">
          <Suspense fallback={<Carregando linhas={1} />}>
            <Lista />
          </Suspense>
        </div>
        <aside className="lg:sticky lg:top-6 lg:self-start">
          <Secao titulo="Novo cupom">
            <Suspense fallback={<div className="h-72 animate-pulse rounded-lg bg-bg/40" />}>
              <Form />
            </Suspense>
          </Secao>
        </aside>
      </div>
    </div>
  );
}
