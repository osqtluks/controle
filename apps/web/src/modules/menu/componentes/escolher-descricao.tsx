"use client";

import { useState, useTransition } from "react";
import { Check, Pencil, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/cn";
import type { atualizarMenuProduto } from "@/modules/produtos/acoes";
import type { ProdutoCardDados } from "@/modules/produtos/componentes/card";
import { criarDescricao, editarDescricao, excluirDescricao, recriarDescricao } from "../acoes";
import type { DescricaoVitrine } from "../tipos";

type Salvar = (d: Parameters<typeof atualizarMenuProduto>[1]) => void;

function Opcao({
  ativa,
  titulo,
  texto,
  onClick,
  acoes,
}: {
  ativa: boolean;
  titulo: string;
  texto: string | null;
  onClick: () => void;
  acoes?: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex items-start gap-2 rounded-lg border p-2",
        ativa ? "border-accent/60 bg-accent/10" : "border-line bg-bg/60 hover:border-white/25",
      )}
    >
      <button type="button" onClick={onClick} className="flex min-w-0 flex-1 items-start gap-2 text-left">
        <span
          className={cn(
            "mt-0.5 grid size-4 shrink-0 place-items-center rounded-full border",
            ativa ? "border-accent bg-accent text-black" : "border-white/30",
          )}
        >
          {ativa && <Check size={11} strokeWidth={3} />}
        </span>
        <span className="min-w-0">
          <span className="block text-xs font-semibold">{titulo}</span>
          {texto && <span className="line-clamp-3 block whitespace-pre-line text-xs text-muted">{texto}</span>}
        </span>
      </button>
      {acoes}
    </div>
  );
}

/**
 * Escolhe o texto do card no Menu: a descrição padrão do produto, uma das vitrines
 * (só do Menu, a padrão fica intacta) ou nenhuma.
 */
export function EscolherDescricao({ p, descricoes, salvar }: { p: ProdutoCardDados; descricoes: DescricaoVitrine[]; salvar: Salvar }) {
  const [, iniciar] = useTransition();
  const [nova, setNova] = useState<string | null>(null);
  const [editando, setEditando] = useState<{ id: string; texto: string } | null>(null);

  const escolhida = p.menu_sem_descricao ? "nenhuma" : (descricoes.find((d) => d.id === p.menu_descricao_id)?.id ?? "padrao");

  function criar() {
    const texto = nova ?? "";
    iniciar(async () => {
      const r = await criarDescricao(p.id, texto);
      if ("erro" in r) return void toast.error(r.erro);
      setNova(null);
      toast.success("Descrição vitrine criada e escolhida.");
    });
  }

  function salvarEdicao() {
    if (!editando) return;
    const e = editando;
    iniciar(async () => {
      try {
        await editarDescricao(e.id, e.texto);
        setEditando(null);
      } catch (err) {
        toast.error((err as Error).message);
      }
    });
  }

  function apagar(d: DescricaoVitrine) {
    const eraEscolhida = escolhida === d.id;
    iniciar(async () => {
      try {
        await excluirDescricao(d.id);
        toast("Descrição vitrine apagada.", {
          action: {
            label: "Desfazer",
            onClick: () => recriarDescricao(d, eraEscolhida).catch((err: Error) => toast.error(err.message)),
          },
        });
      } catch (err) {
        toast.error((err as Error).message);
      }
    });
  }

  return (
    <div className="space-y-1.5">
      <span className="text-xs text-muted">Descrição no cardápio</span>
      <Opcao
        ativa={escolhida === "padrao"}
        titulo="Padrão do produto"
        texto={p.descricao?.trim() || "(sem descrição padrão — dá para escrever em Produtos › Editar)"}
        onClick={() => salvar({ menu_descricao_id: null, menu_sem_descricao: false })}
      />
      {descricoes.map((d, k) =>
        editando?.id === d.id ? (
          <div key={d.id} className="space-y-1.5 rounded-lg border border-accent/50 p-2">
            <textarea
              value={editando.texto}
              maxLength={400}
              rows={3}
              autoFocus
              onChange={(e) => setEditando({ id: d.id, texto: e.target.value })}
              className="w-full rounded-md border border-line bg-bg px-2 py-1.5 text-sm"
            />
            <div className="flex gap-2">
              <button type="button" onClick={salvarEdicao} className="rounded-md bg-accent px-3 py-1 text-xs font-semibold text-black">
                Salvar
              </button>
              <button type="button" onClick={() => setEditando(null)} className="rounded-md border border-line px-3 py-1 text-xs">
                Cancelar
              </button>
            </div>
          </div>
        ) : (
          <Opcao
            key={d.id}
            ativa={escolhida === d.id}
            titulo={`Vitrine ${k + 1}`}
            texto={d.texto}
            onClick={() => salvar({ menu_descricao_id: d.id, menu_sem_descricao: false })}
            acoes={
              <span className="flex shrink-0 gap-1">
                <button
                  type="button"
                  title="Editar"
                  onClick={() => setEditando({ id: d.id, texto: d.texto })}
                  className="rounded p-1 text-muted hover:text-fg"
                >
                  <Pencil size={13} />
                </button>
                <button type="button" title="Apagar" onClick={() => apagar(d)} className="rounded p-1 text-red-400/80 hover:text-red-400">
                  <X size={14} />
                </button>
              </span>
            }
          />
        ),
      )}
      <Opcao
        ativa={escolhida === "nenhuma"}
        titulo="Sem descrição"
        texto={null}
        onClick={() => salvar({ menu_sem_descricao: true })}
      />
      {nova === null ? (
        <button
          type="button"
          onClick={() => setNova("")}
          className="inline-flex items-center gap-1 rounded-lg border border-dashed border-white/20 px-3 py-1.5 text-xs text-muted hover:text-fg"
        >
          <Plus size={13} /> Nova descrição vitrine
        </button>
      ) : (
        <div className="space-y-1.5 rounded-lg border border-accent/50 p-2">
          <textarea
            value={nova}
            maxLength={400}
            rows={3}
            autoFocus
            placeholder="ex.: Aroma cítrico, efeito leve. Colheita nova!"
            onChange={(e) => setNova(e.target.value)}
            className="w-full rounded-md border border-line bg-bg px-2 py-1.5 text-sm"
          />
          <div className="flex items-center gap-2">
            <button type="button" onClick={criar} className="rounded-md bg-accent px-3 py-1 text-xs font-semibold text-black">
              Criar e usar
            </button>
            <button type="button" onClick={() => setNova(null)} className="rounded-md border border-line px-3 py-1 text-xs">
              Cancelar
            </button>
            <span className="ml-auto text-[11px] text-faint">{nova.length}/400</span>
          </div>
        </div>
      )}
    </div>
  );
}
