"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { ImageOff, Plus, X } from "lucide-react";
import { toast } from "sonner";
import {
  calcularItem,
  type ItemCalculado,
  custoPorGrama,
  FAIXAS,
  formatBRL,
  formatGrams,
  formatLucro,
  parseGrams,
  precosEfetivos,
  priceFor,
} from "@ct/core";
import { Campo, Input, Textarea } from "@/components/ui/form";
import { cn } from "@/lib/cn";
import { hojeISO } from "@/lib/datas";
import { SeletorFornecedor, type OpcaoFornecedor } from "@/modules/pessoas/componentes/seletor-fornecedor";
import { tabelaDe } from "@/modules/produtos/tipos";
import type { ProdutoCardDados } from "@/modules/produtos/componentes/card";
import { registrarVenda } from "../acoes";
import { lerDesconto, ROTULO_DESCONTO, ROTULO_FAIXA, type DescontoDigitado, type TipoDesconto } from "../tipos";

interface Linha {
  chave: number;
  produto_id: string;
  quantidade: string;
  desconto: DescontoDigitado;
}

const ATALHOS = ["1", "3,5", "5", "10", "30"];

type Calculo =
  | ({ ok: true; dg: number; custo: number | null; semEstoque: boolean } & ItemCalculado)
  | { ok: false; erro: "quantidade" | "desconto" };

function calcular(l: Linha, p: ProdutoCardDados | undefined): Calculo | null {
  if (!p) return null;
  const dg = parseGrams(l.quantidade);
  const desconto = lerDesconto(l.desconto);
  if (!dg || !desconto) return { ok: false, erro: !dg ? "quantidade" : "desconto" };
  const c = calcularItem(dg, tabelaDe(p), desconto);
  // Custo estimado pelo custo médio do estoque (o real, por lote, sai no registro).
  const cmg = custoPorGrama(p.custo_estoque_cents, p.estoque_dg);
  const custo = cmg !== null ? priceFor(dg, cmg) : null;
  return { ok: true, dg, ...c, custo, semEstoque: dg > p.estoque_dg };
}

function LinhaItem({
  l,
  produtos,
  mudar,
  remover,
}: {
  l: Linha;
  produtos: ProdutoCardDados[];
  mudar: (l: Linha) => void;
  remover: () => void;
}) {
  const p = produtos.find((x) => x.id === l.produto_id);
  const c = calcular(l, p);
  if (!p) return null;
  const ef = precosEfetivos(tabelaDe(p));

  return (
    <div className="space-y-3 rounded-xl border border-line bg-card p-3">
      <div className="flex items-start gap-3">
        <div className="size-11 shrink-0 overflow-hidden rounded-lg bg-hover">
          {p.foto_url ? (
            // eslint-disable-next-line @next/next/no-img-element -- URL assinada temporária
            <img src={p.foto_url} alt="" className="size-full object-cover" />
          ) : (
            <div className="flex size-full items-center justify-center text-faint">
              <ImageOff size={16} />
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate font-medium">{p.nome}</div>
          <div className="text-[11px] text-muted">
            Em estoque: {formatGrams(p.estoque_dg)} ·{" "}
            {FAIXAS.map((f) => `${f.rotulo} ${formatBRL(ef[f.id])}`).join(" · ")}
          </div>
        </div>
        <button type="button" onClick={remover} aria-label="Tirar da venda" className="p-1 text-faint hover:text-red-400">
          <X size={18} />
        </button>
      </div>

      <div className="grid grid-cols-[1fr_auto] items-end gap-2">
        <Campo rotulo="Quantidade (g)">
          <Input
            inputMode="decimal"
            value={l.quantidade}
            onChange={(e) => mudar({ ...l, quantidade: e.target.value })}
            className={cn(c?.ok && c.semEstoque && "border-red-500")}
          />
        </Campo>
        <div className="flex gap-1 pb-0.5">
          {ATALHOS.map((a) => (
            <button
              key={a}
              type="button"
              onClick={() => mudar({ ...l, quantidade: a })}
              className="rounded-md border border-line px-2 py-2 text-xs text-muted hover:bg-hover"
            >
              {a}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Campo rotulo="Desconto">
          <select
            value={l.desconto.tipo}
            onChange={(e) => mudar({ ...l, desconto: { tipo: e.target.value as TipoDesconto, valor: "" } })}
            className="w-full rounded-lg border border-line bg-bg px-3 py-2.5 text-sm outline-none focus:border-accent"
          >
            {(Object.keys(ROTULO_DESCONTO) as TipoDesconto[]).map((t) => (
              <option key={t} value={t}>
                {ROTULO_DESCONTO[t]}
              </option>
            ))}
          </select>
        </Campo>
        {l.desconto.tipo !== "none" && (
          <Campo rotulo={l.desconto.tipo === "percent" ? "Quantos %" : l.desconto.tipo === "fixed" ? "Quanto (R$)" : "Preço por grama (R$)"}>
            <Input
              inputMode="decimal"
              value={l.desconto.valor}
              onChange={(e) => mudar({ ...l, desconto: { ...l.desconto, valor: e.target.value } })}
            />
          </Campo>
        )}
      </div>

      {c?.ok && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-bg/60 px-3 py-2 text-sm">
          <span className="text-xs text-muted">
            Faixa <b className="text-fg">{ROTULO_FAIXA[c.faixa]}</b> · {formatBRL(c.precoListaPorGrama)}/g
            {c.descontoCents > 0 && <span className="text-orange-300"> · desconto {formatBRL(c.descontoCents)}</span>}
          </span>
          <span className="font-semibold tabular-nums">{formatBRL(c.totalCents)}</span>
        </div>
      )}
      {c?.ok && c.semEstoque && <p className="text-xs text-red-400">Só tem {formatGrams(p.estoque_dg)} em estoque.</p>}
      {c && !c.ok && l.quantidade && (
        <p className="text-xs text-red-400">{c.erro === "quantidade" ? "Quantidade inválida (ex.: 3,5)" : "Desconto inválido"}</p>
      )}
    </div>
  );
}

export function NovaVenda({ produtos, clientes }: { produtos: ProdutoCardDados[]; clientes: OpcaoFornecedor[] }) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  const [linhas, setLinhas] = useState<Linha[]>([]);
  const [cliente, setCliente] = useState<string | null>(null);
  const [pagamento, setPagamento] = useState<"pago" | "fiado">("pago");
  const [vencimento, setVencimento] = useState("");
  const [obs, setObs] = useState("");
  const [busca, setBusca] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [seq, setSeq] = useState(1);

  const disponiveis = useMemo(
    () =>
      produtos
        .filter((p) => p.estoque_dg > 0 && !linhas.some((l) => l.produto_id === p.id))
        .filter((p) => !busca || p.nome.toLocaleLowerCase("pt-BR").includes(busca.toLocaleLowerCase("pt-BR"))),
    [produtos, linhas, busca],
  );

  const calc = linhas.map((l) => calcular(l, produtos.find((p) => p.id === l.produto_id)));
  const validos = calc.filter((c): c is Extract<Calculo, { ok: true }> => c?.ok === true);
  const total = validos.reduce((s, c) => s + c.totalCents, 0);
  const desconto = validos.reduce((s, c) => s + c.descontoCents, 0);
  const custo = validos.reduce((s, c) => s + (c.custo ?? 0), 0);
  const gramas = validos.reduce((s, c) => s + c.dg, 0);
  const tudoOk = linhas.length > 0 && validos.length === linhas.length && !validos.some((c) => c.semEstoque);

  function adicionar(id: string) {
    setLinhas((ls) => [...ls, { chave: seq, produto_id: id, quantidade: "", desconto: { tipo: "none", valor: "" } }]);
    setSeq((s) => s + 1);
    setBusca("");
  }

  function registrar() {
    setErro(null);
    iniciar(async () => {
      const r = await registrarVenda({
        cliente_id: cliente,
        data: null,
        pagamento,
        vencimento: vencimento || null,
        observacoes: obs,
        itens: linhas.map((l) => ({ produto_id: l.produto_id, quantidade: l.quantidade, desconto: l.desconto })),
      });
      if ("erro" in r) return setErro(r.erro);
      toast.success(`Venda registrada: ${formatBRL(total)}`);
      router.push(`/vendas/${r.id}`);
    });
  }

  return (
    <div className="grid gap-4 pb-28 lg:grid-cols-[minmax(0,1fr)_340px] lg:pb-0">
      <div className="min-w-0 space-y-3">
        {linhas.map((l) => (
          <LinhaItem
            key={l.chave}
            l={l}
            produtos={produtos}
            mudar={(n) => setLinhas((ls) => ls.map((x) => (x.chave === l.chave ? n : x)))}
            remover={() => setLinhas((ls) => ls.filter((x) => x.chave !== l.chave))}
          />
        ))}

        <section className="rounded-xl border border-dashed border-line p-3">
          <div className="mb-2 flex items-center gap-2 text-sm font-medium">
            <Plus size={16} className="text-accent" /> Adicionar produto
          </div>
          {produtos.some((p) => p.estoque_dg > 0) ? (
            <>
              <input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar…"
                className="mb-2 w-full rounded-lg border border-line bg-bg px-3 py-2 text-sm outline-none focus:border-accent"
              />
              <div className="grid gap-2 sm:grid-cols-2">
                {disponiveis.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => adicionar(p.id)}
                    className="flex items-center gap-2 rounded-lg border border-line bg-card p-2 text-left hover:border-accent/50"
                  >
                    <div className="size-9 shrink-0 overflow-hidden rounded-md bg-hover">
                      {p.foto_url && (
                        // eslint-disable-next-line @next/next/no-img-element -- URL assinada temporária
                        <img src={p.foto_url} alt="" className="size-full object-cover" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">{p.nome}</div>
                      <div className="text-[11px] text-muted">
                        {formatGrams(p.estoque_dg)} · {formatBRL(p.preco_cents_por_grama)}/g
                      </div>
                    </div>
                  </button>
                ))}
                {disponiveis.length === 0 && <p className="text-xs text-muted">Nenhum outro produto com estoque.</p>}
              </div>
            </>
          ) : (
            <p className="text-xs text-muted">Nenhum produto com estoque. Dê entrada em Produtos primeiro.</p>
          )}
        </section>
      </div>

      <aside className="space-y-3 lg:sticky lg:top-6 lg:self-start">
        <section className="space-y-3 rounded-xl border border-line bg-card p-4">
          <Campo rotulo="Cliente">
            <SeletorFornecedor tipoNovo="cliente" fornecedores={clientes} valor={cliente} aoMudar={setCliente} />
          </Campo>
          <div className="grid grid-cols-2 gap-1 rounded-lg border border-line bg-bg p-1 text-sm">
            {(["pago", "fiado"] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setPagamento(v)}
                className={cn(
                  "rounded-md py-2",
                  pagamento === v ? (v === "fiado" ? "bg-orange-500/20 font-medium text-orange-200" : "bg-hover font-medium text-fg") : "text-muted",
                )}
              >
                {v === "pago" ? "Recebi agora" : "Fiado"}
              </button>
            ))}
          </div>
          {pagamento === "fiado" && (
            <Campo rotulo="Combinou pagar em" dica="Parcelas e baixas chegam na fase de Contas.">
              <Input type="date" min={hojeISO()} value={vencimento} onChange={(e) => setVencimento(e.target.value)} />
            </Campo>
          )}
          <Campo rotulo="Observações">
            <Textarea rows={2} value={obs} onChange={(e) => setObs(e.target.value)} />
          </Campo>
        </section>

        {/* Resumo: fixo no rodapé no celular, lateral no PC */}
        <section className="fixed inset-x-0 bottom-[62px] z-10 border-t border-line bg-panel/95 p-3 backdrop-blur lg:static lg:rounded-xl lg:border lg:bg-card lg:p-4">
          <div className="mx-auto flex max-w-3xl items-center gap-3 lg:block lg:space-y-3">
            <dl className="flex-1 text-sm lg:space-y-1">
              <div className="flex justify-between gap-2">
                <dt className="text-muted">Total ({formatGrams(gramas)})</dt>
                <dd className="text-lg font-semibold tabular-nums">{formatBRL(total)}</dd>
              </div>
              <div className="hidden justify-between text-xs lg:flex">
                <dt className="text-faint">Descontos</dt>
                <dd className="tabular-nums text-orange-300">{formatBRL(desconto)}</dd>
              </div>
              <div className="flex justify-between text-xs">
                <dt className="text-faint">Lucro estimado</dt>
                <dd className={cn("tabular-nums", total - custo < 0 ? "text-red-400" : "text-emerald-400")}>
                  {formatLucro(total - custo)}
                </dd>
              </div>
            </dl>
            <button
              type="button"
              onClick={registrar}
              disabled={!tudoOk || pendente}
              className="shrink-0 rounded-lg bg-accent px-5 py-3 text-sm font-semibold text-black disabled:opacity-50 lg:w-full"
            >
              {pendente ? "Registrando…" : "Registrar venda"}
            </button>
          </div>
          {erro && <p className="mt-2 text-sm text-red-400">{erro}</p>}
        </section>
      </aside>
    </div>
  );
}
