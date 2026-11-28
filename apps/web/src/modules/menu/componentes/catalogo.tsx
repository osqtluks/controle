"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { Download, Paintbrush, Share2 } from "lucide-react";
import { toast } from "sonner";
import { formatGrams, ordenarFaixas, stockLevel } from "@ct/core";
import { ControleOrdem, useOrdenacao, type OpcaoOrdem } from "@/components/ui/ordenacao";
import { cn } from "@/lib/cn";
import { hojeISO } from "@/lib/datas";
import { atualizarMenuProduto } from "@/modules/produtos/acoes";
import type { ProdutoCardDados } from "@/modules/produtos/componentes/card";
import { EditarPrecos } from "@/modules/produtos/componentes/editar-precos";
import { limitesDe, tabelaDe, type EstiloMenu } from "@/modules/produtos/tipos";
import { salvarPrefsMenu } from "../acoes";
import type { DescricaoVitrine, PrefsMenu } from "../tipos";
import { EscolherDescricao } from "./escolher-descricao";
import { CardCardapio } from "./card-cardapio";

const ORDEM: OpcaoOrdem<ProdutoCardDados>[] = [
  { id: "estilo", rotulo: "Premium primeiro", valor: (p) => ({ premium: 0, top: 1, simples: 2 })[p.menu_estilo] },
  { id: "nome", rotulo: "Nome", valor: (p) => p.nome },
  { id: "preco", rotulo: "Preço", valor: (p) => p.preco_cents_por_grama, padrao: "desc" },
  { id: "estoque", rotulo: "Estoque", valor: (p) => p.estoque_dg, padrao: "desc" },
];

const ESTILOS: { id: EstiloMenu; rotulo: string; cor: string }[] = [
  { id: "simples", rotulo: "Simples", cor: "border-line" },
  { id: "top", rotulo: "Top ✦", cor: "border-emerald-400/60 text-emerald-300" },
  { id: "premium", rotulo: "Premium ★", cor: "border-amber-400/70 text-amber-300" },
];

/** Controles de aparência de um produto (só aparecem em "Personalizar"; não saem na imagem). */
function AjustesCard({ p, descricoes }: { p: ProdutoCardDados; descricoes: DescricaoVitrine[] }) {
  const [, iniciar] = useTransition();
  const [selo, setSelo] = useState(p.menu_selo ?? "");
  const salvar = (dados: Parameters<typeof atualizarMenuProduto>[1]) =>
    iniciar(async () => {
      try {
        await atualizarMenuProduto(p.id, dados);
      } catch (e) {
        toast.error((e as Error).message);
      }
    });
  const faixas = ordenarFaixas(tabelaDe(p));

  return (
    <div data-nao-exportar className="mt-4 space-y-3 rounded-xl border border-dashed border-white/15 bg-black/30 p-3 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted">Estilo:</span>
        {ESTILOS.map((e) => (
          <button
            key={e.id}
            type="button"
            onClick={() => salvar({ menu_estilo: e.id })}
            className={cn(
              "rounded-lg border px-3 py-1.5 text-xs font-semibold",
              e.cor,
              p.menu_estilo === e.id ? "bg-white/10 ring-2 ring-white/30" : "opacity-70",
            )}
          >
            {e.rotulo}
          </button>
        ))}
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="space-y-1">
          <span className="text-xs text-muted">Faixa em destaque</span>
          <select
            value={p.menu_destaque_dg ?? ""}
            onChange={(e) => salvar({ menu_destaque_dg: e.target.value ? Number(e.target.value) : null })}
            className="w-full rounded-lg border border-line bg-bg px-3 py-2 text-sm"
          >
            <option value="">Nenhuma</option>
            {faixas.map((f) => (
              <option key={f.minDg} value={f.minDg}>
                {formatGrams(f.minDg)}+
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1">
          <span className="text-xs text-muted">Selo (opcional)</span>
          <input
            value={selo}
            maxLength={40}
            onChange={(e) => setSelo(e.target.value)}
            onBlur={() => selo !== (p.menu_selo ?? "") && salvar({ menu_selo: selo.trim() || null })}
            placeholder="ex.: + exótica do ano"
            className="w-full rounded-lg border border-line bg-bg px-3 py-2 text-sm"
          />
        </label>
      </div>
      <EscolherDescricao p={p} descricoes={descricoes} salvar={salvar} />
      <EditarPrecos id={p.id} tabela={faixas} custo={p.custo_ref_cents_por_grama} />
    </div>
  );
}

/** Texto que vai no card: vitrine escolhida, padrão ou nada. */
export function descricaoDoMenu(p: ProdutoCardDados, descricoes: DescricaoVitrine[]): string | null {
  if (p.menu_sem_descricao) return null;
  const v = p.menu_descricao_id ? descricoes.find((d) => d.id === p.menu_descricao_id) : null;
  return v?.texto ?? p.descricao?.trim() ?? null;
}

export function Catalogo({
  produtos,
  prefs,
  descricoes,
}: {
  produtos: ProdutoCardDados[];
  prefs: PrefsMenu;
  descricoes: DescricaoVitrine[];
}) {
  const [personalizando, setPersonalizando] = useState(false);
  const [soComEstoque, setSoComEstoque] = useState(true);
  const [titulo, setTitulo] = useState(prefs.titulo);
  const [subtitulo, setSubtitulo] = useState(prefs.subtitulo);
  const [mostrarEstoque, setMostrarEstoque] = useState(prefs.mostrar_estoque);
  const [gerando, setGerando] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const visiveis = useMemo(
    () => (soComEstoque ? produtos.filter((p) => stockLevel(p.estoque_dg, limitesDe(p)) !== "acabou") : produtos),
    [produtos, soComEstoque],
  );
  const ord = useOrdenacao(visiveis, ORDEM, "estilo");

  function salvarPrefs(n: Partial<PrefsMenu>) {
    const novo = { titulo, subtitulo, mostrar_estoque: mostrarEstoque, ...n };
    salvarPrefsMenu(novo).catch((e: Error) => toast.error(e.message));
  }

  /** Gera uma imagem do catálogo inteiro (mesmo maior que a tela) e compartilha/baixa. */
  async function exportar(modo: "compartilhar" | "baixar") {
    if (!ref.current) return;
    setGerando(true);
    try {
      const { toBlob } = await import("html-to-image");
      const blob = await toBlob(ref.current, {
        pixelRatio: 2,
        cacheBust: true,
        backgroundColor: "#0b0d10",
        // o clone herda a margem do mx-auto e sai deslocado/cortado; na imagem não tem margem.
        style: { margin: "0" },
        filter: (n) => !(n instanceof HTMLElement && n.dataset.naoExportar !== undefined),
      });
      if (!blob) throw new Error("Não consegui gerar a imagem.");
      const nome = `cardapio-${hojeISO()}.png`;
      const arquivo = new File([blob], nome, { type: "image/png" });
      if (modo === "compartilhar" && navigator.canShare?.({ files: [arquivo] })) {
        await navigator.share({ files: [arquivo], title: titulo });
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = nome;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 5000);
        toast.success("Imagem do cardápio salva.");
      }
    } catch (e) {
      if ((e as Error).name !== "AbortError") toast.error((e as Error).message || "Falha ao gerar a imagem.");
    } finally {
      setGerando(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => exportar("compartilhar")}
            disabled={gerando || personalizando}
            className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-black disabled:opacity-50"
          >
            <Share2 size={16} /> {gerando ? "Gerando…" : "Compartilhar cardápio"}
          </button>
          <button
            type="button"
            onClick={() => exportar("baixar")}
            disabled={gerando || personalizando}
            title="Salvar imagem"
            className="inline-flex items-center gap-2 rounded-lg border border-line bg-card px-3 py-2 text-sm text-muted disabled:opacity-50"
          >
            <Download size={16} /> Salvar imagem
          </button>
          <button
            type="button"
            onClick={() => setPersonalizando((v) => !v)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm",
              personalizando ? "border-orange-500/50 bg-orange-500/10 text-orange-300" : "border-line bg-card text-muted",
            )}
          >
            <Paintbrush size={15} /> {personalizando ? "Concluir" : "Personalizar"}
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setSoComEstoque((v) => !v)}
            className={cn("rounded-lg border px-3 py-2 text-sm", soComEstoque ? "border-accent/50 text-accent" : "border-line text-muted")}
          >
            {soComEstoque ? "Só com estoque" : "Todos"}
          </button>
          <ControleOrdem opcoes={ORDEM} {...ord} />
        </div>
      </div>
      {personalizando && (
        <p className="text-xs text-muted">
          Escolha o estilo de cada card, a faixa em destaque e um selo. Os controles tracejados não aparecem na imagem.
        </p>
      )}

      {/* Tudo dentro daqui vira a imagem do cardápio. */}
      <div
        ref={ref}
        className="mx-auto max-w-xl space-y-4 rounded-3xl bg-[radial-gradient(ellipse_at_top,rgba(52,211,153,0.12),transparent_60%),radial-gradient(ellipse_at_bottom,rgba(251,191,36,0.08),transparent_60%)] bg-bg p-4 sm:p-6"
      >
        <header className="pb-1 text-center">
          {personalizando ? (
            <div data-nao-exportar className="space-y-2">
              <input
                value={titulo}
                maxLength={60}
                onChange={(e) => setTitulo(e.target.value)}
                onBlur={() => salvarPrefs({ titulo })}
                className="w-full rounded-lg border border-line bg-bg px-3 py-2 text-center text-2xl font-black"
              />
              <input
                value={subtitulo}
                maxLength={120}
                onChange={(e) => setSubtitulo(e.target.value)}
                onBlur={() => salvarPrefs({ subtitulo })}
                className="w-full rounded-lg border border-line bg-bg px-3 py-1.5 text-center text-sm"
              />
              <label className="inline-flex items-center gap-2 text-xs text-muted">
                <input
                  type="checkbox"
                  checked={mostrarEstoque}
                  onChange={(e) => {
                    setMostrarEstoque(e.target.checked);
                    salvarPrefs({ mostrar_estoque: e.target.checked });
                  }}
                />
                Mostrar quantos gramas tem disponível
              </label>
            </div>
          ) : (
            <>
              <h2 className="bg-gradient-to-r from-emerald-300 via-lime-200 to-amber-300 bg-clip-text text-3xl font-black tracking-tight text-transparent sm:text-4xl">
                {titulo}
              </h2>
              {subtitulo && <p className="mt-1 text-sm text-muted">{subtitulo}</p>}
            </>
          )}
        </header>

        {ord.ordenados.length === 0 ? (
          <p className="rounded-xl border border-dashed border-line p-8 text-center text-sm text-muted">Nada para mostrar.</p>
        ) : (
          ord.ordenados.map((p) => (
            <CardCardapio
              key={p.id}
              mostrarEstoque={mostrarEstoque}
              d={{
                nome: p.nome,
                categoria: p.categoria,
                foto_url: p.foto_url,
                estoque_dg: p.estoque_dg,
                faixas: tabelaDe(p),
                estilo: p.menu_estilo ?? "simples",
                destaqueDg: p.menu_destaque_dg,
                selo: p.menu_selo,
                descricao: descricaoDoMenu(p, descricoes),
              }}
            >
              {personalizando && <AjustesCard p={p} descricoes={descricoes.filter((d) => d.produto_id === p.id)} />}
            </CardCardapio>
          ))
        )}
      </div>
    </div>
  );
}
