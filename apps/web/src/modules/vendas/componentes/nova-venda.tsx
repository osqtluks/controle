"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { Check, ImageOff, Plus, Ticket, X } from "lucide-react";
import { toast } from "sonner";
import {
  calcularItem,
  consumirFifo,
  descontoGeral,
  formatBps,
  formatBRL,
  formatGrams,
  formatLucro,
  parseGrams,
  ordenarFaixas,
  ratear,
  rotuloFaixa,
  type ItemCalculado,
  type SaldoDeLote,
} from "@ct/core";
import { Campo, Input, Textarea } from "@/components/ui/form";
import { cn } from "@/lib/cn";
import { hojeISO } from "@/lib/datas";
import { SeletorFornecedor, type OpcaoFornecedor } from "@/modules/pessoas/componentes/seletor-fornecedor";
import { tabelaDe } from "@/modules/produtos/tipos";
import type { ProdutoCardDados } from "@/modules/produtos/componentes/card";
import { buscarCupom, registrarVenda, type CupomValido } from "../acoes";
import {
  descreverDesconto,
  lerDesconto,
  ROTULO_DESCONTO,
  type DescontoDigitado,
  type TipoDesconto,
} from "../tipos";

interface Linha {
  chave: number;
  produto_id: string;
  quantidade: string;
  desconto: DescontoDigitado;
}

type Calculo =
  | ({ ok: true; dg: number; custo: number; semEstoque: boolean } & ItemCalculado)
  | { ok: false; erro: "quantidade" | "desconto" };

const ATALHOS = ["1", "3,5", "5", "10", "30"];

/** Preço pela tabela + custo EXATO pelos lotes que vão sair (mais antigos primeiro). */
function calcular(l: Linha, p: ProdutoCardDados | undefined, lotes: SaldoDeLote[]): Calculo | null {
  if (!p) return null;
  const dg = parseGrams(l.quantidade);
  const desconto = lerDesconto(l.desconto);
  if (!dg || !desconto) return { ok: false, erro: !dg ? "quantidade" : "desconto" };
  const c = calcularItem(dg, tabelaDe(p), desconto);
  const semEstoque = dg > p.estoque_dg;
  const custo = semEstoque ? 0 : consumirFifo(lotes, dg).reduce((s, x) => s + x.custoCents, 0);
  return { ok: true, dg, ...c, custo, semEstoque };
}

function Foto({ url, tam = "size-11" }: { url: string | null; tam?: string }) {
  return (
    <div className={cn(tam, "shrink-0 overflow-hidden rounded-lg bg-hover")}>
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element -- URL assinada temporária
        <img src={url} alt="" className="size-full object-cover" />
      ) : (
        <div className="flex size-full items-center justify-center text-faint">
          <ImageOff size={16} />
        </div>
      )}
    </div>
  );
}

function LinhaItem({
  l,
  p,
  c,
  rateio,
  mudar,
  remover,
}: {
  l: Linha;
  p: ProdutoCardDados;
  c: Calculo | null;
  rateio: number;
  mudar: (l: Linha) => void;
  remover: () => void;
}) {
  const faixas = ordenarFaixas(tabelaDe(p));
  const fat = c?.ok ? c.totalCents - rateio : 0;
  const lucro = c?.ok ? fat - c.custo : 0;

  return (
    <div className="space-y-3 rounded-xl border border-line bg-card p-3">
      <div className="flex items-start gap-3">
        <Foto url={p.foto_url} />
        <div className="min-w-0 flex-1">
          <div className="truncate font-medium">{p.nome}</div>
          <div className="text-[11px] text-muted">
            Em estoque: {formatGrams(p.estoque_dg)} · {faixas.map((f) => `${rotuloFaixa(f.minDg)} ${formatBRL(f.precoCents)}`).join(" · ")}
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
        <div className="space-y-1.5 rounded-lg bg-bg/60 px-3 py-2 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
            <span>
              Faixa <b className="text-fg">{rotuloFaixa(c.faixaMinDg)}</b> · {formatBRL(c.precoListaPorGrama)}/g ·{" "}
              {formatBRL(c.subtotalCents)}
            </span>
            {c.descontoCents > 0 && <span className="text-orange-300">−{formatBRL(c.descontoCents)}</span>}
          </div>
          {rateio > 0 && (
            <div className="flex justify-between text-xs text-orange-300">
              <span>Parte do desconto geral</span>
              <span>−{formatBRL(rateio)}</span>
            </div>
          )}
          <div className="grid grid-cols-2 gap-2 border-t border-line/60 pt-1.5">
            <div>
              <div className="text-[11px] text-faint">Faturamento</div>
              <div className="font-semibold tabular-nums">{formatBRL(fat)}</div>
            </div>
            <div className="text-right">
              <div className="text-[11px] text-faint">Lucro</div>
              <div className={cn("font-semibold tabular-nums", lucro < 0 ? "text-red-400" : "text-emerald-400")}>
                {formatLucro(lucro)}
                {fat > 0 && <span className="ml-1 text-[11px] font-normal text-faint">{formatBps(Math.round((lucro * 10000) / fat))}</span>}
              </div>
            </div>
          </div>
        </div>
      )}
      {c?.ok && c.semEstoque && <p className="text-xs text-red-400">Só tem {formatGrams(p.estoque_dg)} em estoque.</p>}
      {c && !c.ok && l.quantidade && (
        <p className="text-xs text-red-400">{c.erro === "quantidade" ? "Quantidade inválida (ex.: 3,5)" : "Desconto inválido"}</p>
      )}
    </div>
  );
}

/** Desconto da venda toda: Cupom (código → %) ou % direto. */
function DescontoGeral({
  modo,
  setModo,
  codigo,
  setCodigo,
  pct,
  setPct,
  cupom,
  erroCupom,
}: {
  modo: "cupom" | "percent";
  setModo: (m: "cupom" | "percent") => void;
  codigo: string;
  setCodigo: (v: string) => void;
  pct: string;
  setPct: (v: string) => void;
  cupom: CupomValido | null;
  erroCupom: string | null;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted">Desconto na venda toda</span>
        <div className="flex rounded-md border border-line bg-bg p-0.5 text-xs">
          {(["cupom", "percent"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setModo(m)}
              className={cn("rounded px-2.5 py-1", modo === m ? "bg-hover font-semibold text-fg" : "text-muted")}
            >
              {m === "cupom" ? "Cupom" : "%"}
            </button>
          ))}
        </div>
      </div>
      {modo === "cupom" ? (
        <div className="relative">
          <Ticket size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
          <Input
            value={codigo}
            onChange={(e) => setCodigo(e.target.value.toUpperCase().replace(/\s/g, ""))}
            placeholder="CÓDIGO DO CUPOM"
            className={cn("pl-9 uppercase tracking-wider", cupom && "border-emerald-500", erroCupom && codigo && "border-red-500")}
          />
          {cupom && <Check size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-emerald-400" />}
        </div>
      ) : (
        <div className="relative">
          <Input inputMode="decimal" value={pct} onChange={(e) => setPct(e.target.value)} placeholder="0" className="pr-8" />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-faint">%</span>
        </div>
      )}
      {modo === "cupom" && cupom && (
        <p className="text-[11px] text-emerald-400">
          {cupom.codigo}: {formatBps(cupom.bps)} de desconto{cupom.restam !== null ? ` · restam ${cupom.restam} uso(s)` : ""}
        </p>
      )}
      {modo === "cupom" && erroCupom && codigo && <p className="text-[11px] text-red-400">{erroCupom}</p>}
    </div>
  );
}

export function NovaVenda({
  produtos,
  clientes,
  lotes,
}: {
  produtos: ProdutoCardDados[];
  clientes: OpcaoFornecedor[];
  lotes: Record<string, SaldoDeLote[]>;
}) {
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
  const [modoGeral, setModoGeral] = useState<"cupom" | "percent">("cupom");
  const [codigo, setCodigo] = useState("");
  const [pctGeral, setPctGeral] = useState("");
  const [cupomAchado, setCupomAchado] = useState<{ codigo: string; r: CupomValido | { erro: string } } | null>(null);

  // Confere o cupom enquanto digita (com pequena espera).
  useEffect(() => {
    if (modoGeral !== "cupom" || codigo.length < 2) return;
    const t = setTimeout(async () => setCupomAchado({ codigo, r: await buscarCupom(codigo) }), 400);
    return () => clearTimeout(t);
  }, [codigo, modoGeral]);
  const resposta = cupomAchado && cupomAchado.codigo === codigo ? cupomAchado.r : null;
  const cupom = modoGeral === "cupom" && resposta && !("erro" in resposta) ? resposta : null;
  const erroCupom = modoGeral === "cupom" && resposta && "erro" in resposta ? resposta.erro : null;

  const porId = useMemo(() => new Map(produtos.map((p) => [p.id, p])), [produtos]);
  const disponiveis = useMemo(
    () =>
      produtos
        .filter((p) => p.estoque_dg > 0 && !linhas.some((l) => l.produto_id === p.id))
        .filter((p) => !busca || p.nome.toLocaleLowerCase("pt-BR").includes(busca.toLocaleLowerCase("pt-BR"))),
    [produtos, linhas, busca],
  );

  const calc = linhas.map((l) => calcular(l, porId.get(l.produto_id), lotes[l.produto_id] ?? []));
  const okCalc = calc.map((c) => (c?.ok ? c : null));
  const somaItens = okCalc.reduce((s, c) => s + (c?.totalCents ?? 0), 0);

  const pctNum = Number(pctGeral.replace(",", "."));
  const bpsGeral =
    modoGeral === "cupom" ? (cupom?.bps ?? 0) : Number.isFinite(pctNum) && pctNum > 0 && pctNum <= 100 ? Math.round(pctNum * 100) : 0;
  const geralCents = descontoGeral(somaItens, bpsGeral);
  const rateios = ratear(okCalc.map((c) => c?.totalCents ?? 0), geralCents);

  const subtotal = okCalc.reduce((s, c) => s + (c?.subtotalCents ?? 0), 0);
  const total = somaItens - geralCents;
  const custo = okCalc.reduce((s, c) => s + (c?.custo ?? 0), 0);
  const gramas = okCalc.reduce((s, c) => s + (c?.dg ?? 0), 0);
  const lucro = total - custo;
  const tudoOk =
    linhas.length > 0 &&
    okCalc.every((c) => c && !c.semEstoque) &&
    !(modoGeral === "cupom" && codigo && !cupom) &&
    !(modoGeral === "percent" && pctGeral && bpsGeral === 0);

  // Linhas de desconto com o motivo: "15% em lennyrivis  −R$ 408,00"
  const linhasDesconto = linhas.flatMap((l, i) => {
    const c = okCalc[i];
    const p = porId.get(l.produto_id);
    if (!c || !p || c.descontoCents <= 0) return [];
    const d = lerDesconto(l.desconto);
    const como =
      d?.kind === "percent"
        ? descreverDesconto("percent", d.bps)
        : d?.kind === "perGram"
          ? `preço ${descreverDesconto("perGram", d.centsPerGram)}`
          : "desconto";
    return [{ chave: `i${l.chave}`, valor: c.descontoCents, motivo: `${como} em ${p.nome}` }];
  });
  if (geralCents > 0)
    linhasDesconto.push({
      chave: "geral",
      valor: geralCents,
      motivo: modoGeral === "cupom" && cupom ? `cupom ${cupom.codigo} (${formatBps(cupom.bps)})` : `${formatBps(bpsGeral)} na venda toda`,
    });

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
        geral:
          modoGeral === "cupom" && codigo
            ? { modo: "cupom", codigo }
            : modoGeral === "percent" && pctGeral
              ? { modo: "percent", valor: pctGeral }
              : { modo: "none" },
      });
      if ("erro" in r) return setErro(r.erro);
      toast.success(`Venda registrada: ${formatBRL(total)}`);
      router.push(`/vendas/${r.id}`);
    });
  }

  return (
    <div className="grid gap-4 pb-48 lg:grid-cols-[minmax(0,1fr)_360px] lg:pb-0">
      <div className="min-w-0 space-y-3">
        {linhas.map((l, i) => {
          const p = porId.get(l.produto_id);
          if (!p) return null;
          return (
            <LinhaItem
              key={l.chave}
              l={l}
              p={p}
              c={calc[i] ?? null}
              rateio={rateios[i] ?? 0}
              mudar={(n) => setLinhas((ls) => ls.map((x) => (x.chave === l.chave ? n : x)))}
              remover={() => setLinhas((ls) => ls.filter((x) => x.chave !== l.chave))}
            />
          );
        })}

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
                    <Foto url={p.foto_url} tam="size-9" />
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
          <DescontoGeral
            modo={modoGeral}
            setModo={setModoGeral}
            codigo={codigo}
            setCodigo={setCodigo}
            pct={pctGeral}
            setPct={setPctGeral}
            cupom={cupom}
            erroCupom={erroCupom}
          />
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
        <section className="fixed inset-x-0 bottom-[62px] z-10 max-h-[45vh] overflow-y-auto border-t border-line bg-panel/95 p-3 backdrop-blur lg:static lg:max-h-none lg:rounded-xl lg:border lg:bg-card lg:p-4">
          <div className="mx-auto max-w-3xl space-y-2">
            <dl className="space-y-1 text-sm">
              {linhasDesconto.length > 0 && (
                <div className="flex justify-between text-xs">
                  <dt className="text-faint">Subtotal</dt>
                  <dd className="tabular-nums text-muted">{formatBRL(subtotal)}</dd>
                </div>
              )}
              {linhasDesconto.map((d) => (
                <div key={d.chave} className="flex justify-between gap-2 text-xs">
                  <dt className="truncate text-orange-300/90">{d.motivo}</dt>
                  <dd className="shrink-0 tabular-nums text-orange-300">−{formatBRL(d.valor)}</dd>
                </div>
              ))}
              <div className="flex items-baseline justify-between gap-2 border-t border-line/60 pt-1">
                <dt className="text-muted">Faturamento ({formatGrams(gramas)})</dt>
                <dd className="text-lg font-semibold tabular-nums">{formatBRL(total)}</dd>
              </div>
              <div className="flex justify-between text-xs">
                <dt className="text-faint">Lucro</dt>
                <dd className={cn("font-semibold tabular-nums", lucro < 0 ? "text-red-400" : "text-emerald-400")}>
                  {formatLucro(lucro)}
                  {total > 0 && <span className="ml-1 font-normal text-faint">{formatBps(Math.round((lucro * 10000) / total))}</span>}
                </dd>
              </div>
            </dl>
            <button
              type="button"
              onClick={registrar}
              disabled={!tudoOk || pendente}
              className="w-full rounded-lg bg-accent px-5 py-3 text-sm font-semibold text-black disabled:opacity-50"
            >
              {pendente ? "Registrando…" : "Registrar venda"}
            </button>
            {erro && <p className="text-sm text-red-400">{erro}</p>}
          </div>
        </section>
      </aside>
    </div>
  );
}
