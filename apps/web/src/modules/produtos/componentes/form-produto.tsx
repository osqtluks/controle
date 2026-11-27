"use client";

import { useActionState, useState } from "react";
import { ImagePlus } from "lucide-react";
import { dgToGrams, formatBRL, type StockThresholds } from "@ct/core";
import { StockBar } from "@/components/stock-bar";
import { Botao, Campo, Erro, Input, Textarea } from "@/components/ui/form";
import { comprimirImagem } from "@/lib/imagem";
import { salvarProduto, type EstadoForm } from "../acoes";
import type { ProdutoCardDados } from "./card";

const NIVEIS: { nome: keyof StockThresholds; campo: string; rotulo: string; cor: string }[] = [
  { nome: "cheio", campo: "lim_cheio", rotulo: "Cheio", cor: "bg-emerald-500" },
  { nome: "metade", campo: "lim_metade", rotulo: "Na metade", cor: "bg-amber-400" },
  { nome: "acabando", campo: "lim_acabando", rotulo: "Chegando ao fim", cor: "bg-orange-500" },
  { nome: "muitoBaixo", campo: "lim_muito_baixo", rotulo: "Muito baixo", cor: "bg-red-500" },
  { nome: "acabou", campo: "lim_acabou", rotulo: "Acabou", cor: "bg-zinc-500" },
];

const g = (dg: number) => String(dgToGrams(dg)).replace(".", ",");
const lerG = (s: string) => Math.round(Number(s.replace(",", ".")) * 10) || 0;

export function FormProduto({ produto, categorias }: { produto?: ProdutoCardDados; categorias: string[] }) {
  const [estado, acao, enviando] = useActionState<EstadoForm, FormData>(salvarProduto, {});
  const [foto, setFoto] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(produto?.foto_url ?? null);
  const [processando, setProcessando] = useState(false);
  const [lim, setLim] = useState<Record<keyof StockThresholds, string>>({
    cheio: produto ? g(produto.lim_cheio_dg) : "50",
    metade: produto ? g(produto.lim_metade_dg) : "25",
    acabando: produto ? g(produto.lim_acabando_dg) : "10",
    muitoBaixo: produto ? g(produto.lim_muito_baixo_dg) : "5",
    acabou: produto ? g(produto.lim_acabou_dg) : "0",
  });
  const limDg: StockThresholds = {
    cheio: lerG(lim.cheio),
    metade: lerG(lim.metade),
    acabando: lerG(lim.acabando),
    muitoBaixo: lerG(lim.muitoBaixo),
    acabou: lerG(lim.acabou),
  };

  async function escolherFoto(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setProcessando(true);
    try {
      const c = await comprimirImagem(f);
      setFoto(c);
      setPreview(URL.createObjectURL(c));
    } finally {
      setProcessando(false);
    }
  }

  return (
    <form
      action={(fd) => {
        fd.delete("foto_original");
        if (foto) fd.set("foto", foto);
        acao(fd);
      }}
      className="space-y-6"
    >
      {produto && <input type="hidden" name="id" value={produto.id} />}

      <section className="grid gap-4 rounded-xl border border-line bg-card p-4 sm:grid-cols-[auto_1fr]">
        <label className="relative flex size-28 cursor-pointer items-center justify-center overflow-hidden rounded-xl border border-dashed border-line bg-bg text-faint hover:border-accent">
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element -- prévia local
            <img src={preview} alt="Foto do produto" className="size-full object-cover" />
          ) : (
            <span className="flex flex-col items-center gap-1 text-xs">
              <ImagePlus size={22} /> {processando ? "Processando…" : "Foto"}
            </span>
          )}
          <input name="foto_original" type="file" accept="image/*" className="sr-only" onChange={escolherFoto} />
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <Campo rotulo="Nome *" className="sm:col-span-2">
            <Input name="nome" required defaultValue={produto?.nome} maxLength={120} />
          </Campo>
          <Campo rotulo="Categoria">
            <Input name="categoria" list="categorias" defaultValue={produto?.categoria ?? ""} />
            <datalist id="categorias">
              {categorias.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </Campo>
          <Campo rotulo="Preço por grama (R$) *" dica="Ex.: 12,50">
            <Input
              name="preco"
              required
              inputMode="decimal"
              defaultValue={produto ? (produto.preco_cents_por_grama / 100).toFixed(2).replace(".", ",") : ""}
            />
          </Campo>
        </div>
      </section>

      <section className="space-y-3 rounded-xl border border-line bg-card p-4">
        <div>
          <h2 className="font-medium">Níveis de estoque</h2>
          <p className="text-xs text-muted">
            Em gramas. O aviso de reposição dispara em <b>chegando ao fim</b>, <b>muito baixo</b> e <b>acabou</b>.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {NIVEIS.map((n) => (
            <Campo key={n.nome} rotulo={n.rotulo}>
              <div className="relative">
                <span className={`absolute left-3 top-1/2 size-2 -translate-y-1/2 rounded-full ${n.cor}`} />
                <Input
                  name={n.campo}
                  inputMode="decimal"
                  required
                  value={lim[n.nome]}
                  onChange={(e) => setLim((l) => ({ ...l, [n.nome]: e.target.value }))}
                  className="pl-7 pr-7"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-faint">g</span>
              </div>
            </Campo>
          ))}
        </div>
        <div className="space-y-2 pt-1">
          <p className="text-[11px] text-faint">Prévia de como a barra fica em cada nível:</p>
          {(["cheio", "metade", "acabando", "muitoBaixo"] as const).map((k) => (
            <StockBar key={k} qty={limDg[k]} limites={limDg} />
          ))}
        </div>
      </section>

      <section className="grid gap-3 rounded-xl border border-line bg-card p-4">
        <Campo rotulo="Descrição">
          <Textarea name="descricao" defaultValue={produto?.descricao ?? ""} />
        </Campo>
        <Campo rotulo="Observações">
          <Textarea name="observacoes" defaultValue={produto?.observacoes ?? ""} />
        </Campo>
      </section>

      <Erro>{estado.erro}</Erro>
      <div className="flex gap-2">
        <Botao disabled={enviando || processando}>{enviando ? "Salvando…" : produto ? "Salvar alterações" : "Criar produto"}</Botao>
        {produto && (
          <span className="self-center text-xs text-faint">Preço atual: {formatBRL(produto.preco_cents_por_grama)}/g</span>
        )}
      </div>
    </form>
  );
}
