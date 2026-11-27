"use client";

import { useState, useTransition } from "react";
import { cn } from "@/lib/cn";
import { criarFornecedorRapido } from "../acoes";

export interface OpcaoFornecedor {
  id: string;
  nome: string;
}

const NOVO = "__novo__";

/**
 * Lista de fornecedores com "+ Novo fornecedor…" que cadastra na hora, sem sair da tela.
 * Com `name`, envia o id escolhido num campo oculto do formulário.
 * Com `aoMudar`, avisa a cada escolha (para salvar na hora).
 */
export function SeletorFornecedor({
  fornecedores,
  valor,
  aoMudar,
  name,
  compacto,
  desabilitado,
}: {
  fornecedores: OpcaoFornecedor[];
  valor: string | null;
  aoMudar?: (id: string | null) => void;
  name?: string;
  compacto?: boolean;
  desabilitado?: boolean;
}) {
  const [lista, setLista] = useState(fornecedores);
  const [atual, setAtual] = useState(valor ?? "");
  const [criando, setCriando] = useState(false);
  const [nome, setNome] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();

  // Quando a página recarrega os dados (ex.: fornecedor trocado em outro lugar), acompanha.
  const [anterior, setAnterior] = useState({ valor, fornecedores });
  if (anterior.valor !== valor || anterior.fornecedores !== fornecedores) {
    setAnterior({ valor, fornecedores });
    setLista(fornecedores);
    setAtual(valor ?? "");
  }

  function escolher(id: string) {
    if (id === NOVO) {
      setCriando(true);
      return;
    }
    setAtual(id);
    aoMudar?.(id || null);
  }

  function criar() {
    setErro(null);
    iniciar(async () => {
      const r = await criarFornecedorRapido(nome);
      if ("erro" in r) return setErro(r.erro);
      setLista((l) => [...l, r].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")));
      setAtual(r.id);
      setCriando(false);
      setNome("");
      aoMudar?.(r.id);
    });
  }

  const campo = cn(
    "w-full rounded-lg border border-line bg-bg outline-none focus:border-accent disabled:opacity-60",
    compacto ? "px-2 py-1.5 text-sm" : "px-3 py-2.5 text-sm",
  );

  return (
    <div className="space-y-1">
      {name && <input type="hidden" name={name} value={atual} />}
      {criando ? (
        <div className="flex gap-1">
          <input
            autoFocus
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                criar();
              }
              if (e.key === "Escape") setCriando(false);
            }}
            placeholder="Nome do fornecedor"
            className={campo}
          />
          <button
            type="button"
            onClick={criar}
            disabled={pendente || !nome.trim()}
            className="shrink-0 rounded-lg bg-accent px-3 text-sm font-semibold text-black disabled:opacity-60"
          >
            {pendente ? "…" : "Criar"}
          </button>
          <button type="button" onClick={() => setCriando(false)} className="shrink-0 px-2 text-sm text-muted">
            ✕
          </button>
        </div>
      ) : (
        <select
          aria-label="Fornecedor"
          value={atual}
          disabled={desabilitado || pendente}
          onChange={(e) => escolher(e.target.value)}
          className={campo}
        >
          <option value="">— sem fornecedor —</option>
          {lista.map((f) => (
            <option key={f.id} value={f.id}>
              {f.nome}
            </option>
          ))}
          <option value={NOVO}>+ Novo fornecedor…</option>
        </select>
      )}
      {erro && <p className="text-[11px] text-red-400">{erro}</p>}
    </div>
  );
}
