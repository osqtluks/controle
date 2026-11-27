"use client";

import { useState, useTransition } from "react";
import { CalendarClock, RotateCcw, Undo2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { alocarPagamento, diasEntre, formatBRL, parseBRL, somarDias } from "@ct/core";
import { Botao, Campo, Erro, Input } from "@/components/ui/form";
import { cn } from "@/lib/cn";
import { formatData, hojeISO } from "@/lib/datas";
import { restaurarExclusao } from "@/modules/produtos/acoes";
import {
  cancelarConta,
  estornarPagamento,
  reativarConta,
  reativarPagamento,
  registrarPagamento,
  remarcarParcela,
} from "../acoes";
import { FORMAS, type Forma, type Pagamento, type Parcela } from "../tipos";

/** Registrar recebimento/pagamento de qualquer valor, com prévia de onde ele vai abater. */
export function FormPagamento({
  contaId,
  tipo,
  parcelas,
}: {
  contaId: string;
  tipo: "receber" | "pagar";
  parcelas: Parcela[];
}) {
  const abertas = parcelas
    .filter((p) => p.restante_cents > 0)
    .sort((a, b) => (a.vencimento_atual ?? "9999").localeCompare(b.vencimento_atual ?? "9999") || a.numero - b.numero);
  const falta = abertas.reduce((s, p) => s + p.restante_cents, 0);
  const proxima = abertas[0];
  const [valor, setValor] = useState("");
  const [data, setData] = useState(hojeISO());
  const [forma, setForma] = useState<Forma>("pix");
  const [obs, setObs] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();

  if (falta <= 0) return <p className="text-sm text-sky-300">Conta quitada. 🎉</p>;

  const v = parseBRL(valor);
  let previa: string | null = null;
  if (v && v > 0) {
    if (v > falta) previa = `Passa do que falta (${formatBRL(falta)}).`;
    else {
      const al = alocarPagamento(abertas.map((p) => ({ id: p.id, restanteCents: p.restante_cents })), v);
      previa = al
        .map((a) => {
          const p = abertas.find((x) => x.id === a.parcelaId)!;
          const quita = a.valorCents === p.restante_cents;
          return abertas.length === 1 && parcelas.length === 1
            ? quita
              ? "quita a conta"
              : `abate ${formatBRL(a.valorCents)}, falta ${formatBRL(p.restante_cents - a.valorCents)}`
            : quita
              ? `quita a ${p.numero}ª parcela`
              : `abate ${formatBRL(a.valorCents)} da ${p.numero}ª`;
        })
        .join(" · ");
    }
  }

  function enviar() {
    setErro(null);
    iniciar(async () => {
      const r = await registrarPagamento(contaId, valor, data, forma, obs);
      if ("erro" in r) return setErro(r.erro);
      toast(`${tipo === "receber" ? "Recebimento" : "Pagamento"} de ${formatBRL(v ?? 0)} registrado.`, {
        duration: 10_000,
        action: { label: "Desfazer", onClick: () => toast.promise(estornarPagamento(r.id), { success: "Desfeito.", error: (e: Error) => e.message }) },
      });
      setValor("");
      setObs("");
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5">
        {proxima && proxima.restante_cents !== falta && (
          <button
            type="button"
            onClick={() => setValor(String(proxima.restante_cents / 100).replace(".", ","))}
            className="rounded-md border border-line px-2.5 py-1.5 text-xs text-muted hover:bg-hover"
          >
            Próxima parcela {formatBRL(proxima.restante_cents)}
          </button>
        )}
        <button
          type="button"
          onClick={() => setValor(String(falta / 100).replace(".", ","))}
          className="rounded-md border border-line px-2.5 py-1.5 text-xs text-muted hover:bg-hover"
        >
          Tudo {formatBRL(falta)}
        </button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Campo rotulo="Valor (R$)">
          <Input inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value)} placeholder="qualquer valor" />
        </Campo>
        <Campo rotulo="Data">
          <Input type="date" value={data} onChange={(e) => setData(e.target.value)} />
        </Campo>
      </div>
      <div className="flex flex-wrap gap-1">
        {(Object.keys(FORMAS) as Forma[]).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setForma(f)}
            className={cn("rounded-md border px-2.5 py-1.5 text-xs", forma === f ? "border-accent/60 bg-accent/10 text-accent" : "border-line text-muted")}
          >
            {FORMAS[f]}
          </button>
        ))}
      </div>
      <Input value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Observação (opcional)" />
      {previa && <p className={cn("text-xs", v && v > falta ? "text-red-400" : "text-emerald-400")}>→ {previa}</p>}
      <Erro>{erro}</Erro>
      <Botao onClick={enviar} disabled={pendente || !v || v > falta} className="w-full">
        {pendente ? "Salvando…" : tipo === "receber" ? "Registrar recebimento" : "Registrar pagamento"}
      </Botao>
    </div>
  );
}

/** Remarcar (postergar ou antecipar) uma parcela, com atalhos +7/+15/+30. */
export function Remarcar({ parcela }: { parcela: Parcela }) {
  const [aberto, setAberto] = useState(false);
  const base = parcela.vencimento_atual ?? hojeISO();
  const [nova, setNova] = useState(parcela.vencimento_atual ? somarDias(base, 7) : hojeISO());
  const [motivo, setMotivo] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();

  if (!aberto)
    return (
      <button
        type="button"
        onClick={() => setAberto(true)}
        className="inline-flex items-center gap-1 rounded-md border border-line px-2 py-1 text-xs text-muted hover:bg-hover hover:text-fg"
      >
        <CalendarClock size={13} /> {parcela.vencimento_atual ? "Remarcar" : "Definir data"}
      </button>
    );

  const dias = parcela.vencimento_atual && nova ? diasEntre(parcela.vencimento_atual, nova) : null;
  return (
    <div className="space-y-2 rounded-lg border border-accent/40 bg-bg/60 p-2 text-left">
      {parcela.vencimento_atual && (
        <div className="flex gap-1">
          {[7, 15, 30].map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setNova(somarDias(parcela.vencimento_atual!, d))}
              className="rounded-md border border-line px-2 py-1 text-xs text-muted hover:bg-hover"
            >
              +{d} dias
            </button>
          ))}
        </div>
      )}
      <Input type="date" value={nova} onChange={(e) => setNova(e.target.value)} className="py-1.5" />
      <Input value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Motivo (opcional)" className="py-1.5" />
      {dias !== null && dias !== 0 && (
        <p className={cn("text-[11px]", dias > 0 ? "text-violet-300" : "text-emerald-400")}>
          {dias > 0 ? `Posterga ${dias} dia(s)` : `Antecipa ${-dias} dia(s)`} · de {formatData(parcela.vencimento_atual)} para {formatData(nova)}
        </p>
      )}
      <Erro>{erro}</Erro>
      <div className="flex gap-1">
        <button
          type="button"
          disabled={pendente}
          onClick={() =>
            iniciar(async () => {
              const r = await remarcarParcela(parcela.id, nova, motivo);
              if ("erro" in r) return setErro(r.erro);
              toast.success("Data remarcada.");
              setAberto(false);
            })
          }
          className="rounded-md bg-accent px-3 py-1.5 text-xs font-semibold text-black disabled:opacity-60"
        >
          Salvar
        </button>
        <button type="button" onClick={() => setAberto(false)} className="px-2 text-xs text-muted">
          Cancelar
        </button>
      </div>
    </div>
  );
}

export function BotaoEstorno({ p }: { p: Pagamento }) {
  const [pendente, iniciar] = useTransition();
  if (p.estornado_em)
    return (
      <button
        type="button"
        disabled={pendente}
        onClick={() =>
          iniciar(async () => {
            try {
              await reativarPagamento(p.id);
              toast.success("Pagamento reativado.");
            } catch (e) {
              toast.error((e as Error).message);
            }
          })
        }
        className="inline-flex items-center gap-1 text-xs text-emerald-400 hover:underline"
      >
        <RotateCcw size={12} /> Reativar
      </button>
    );
  return (
    <button
      type="button"
      disabled={pendente}
      onClick={() => {
        if (!confirm(`Estornar o pagamento de ${formatBRL(p.valor_cents)}? O valor volta a ficar em aberto.`)) return;
        iniciar(async () => {
          await estornarPagamento(p.id);
          toast(`Pagamento de ${formatBRL(p.valor_cents)} estornado.`, {
            duration: 10_000,
            action: { label: "Desfazer", onClick: () => toast.promise(reativarPagamento(p.id), { success: "Reativado.", error: (e: Error) => e.message }) },
          });
        });
      }}
      className="inline-flex items-center gap-1 text-xs text-red-400/80 hover:text-red-400"
    >
      <Undo2 size={12} /> Estornar
    </button>
  );
}

export function BotaoCancelarConta({ id, numero }: { id: string; numero: number }) {
  const [pendente, iniciar] = useTransition();
  return (
    <button
      type="button"
      disabled={pendente}
      onClick={() => {
        if (!confirm(`Cancelar a conta #${numero}? Ela sai das pendências. Dá para desfazer.`)) return;
        iniciar(async () => {
          const ex = await cancelarConta(id);
          toast(`Conta #${numero} cancelada.`, {
            duration: 10_000,
            action: { label: "Desfazer", onClick: () => toast.promise(restaurarExclusao(ex), { success: "Conta reativada.", error: (e: Error) => e.message }) },
          });
        });
      }}
      className="inline-flex items-center gap-2 rounded-lg border border-red-500/40 px-3 py-2.5 text-sm font-semibold text-red-400 hover:bg-red-500/10 disabled:opacity-60"
    >
      <XCircle size={16} /> Cancelar conta
    </button>
  );
}

export function BotaoReativarConta({ id }: { id: string }) {
  const [pendente, iniciar] = useTransition();
  return (
    <button
      type="button"
      disabled={pendente}
      onClick={() =>
        iniciar(async () => {
          try {
            await reativarConta(id);
            toast.success("Conta reativada.");
          } catch (e) {
            toast.error((e as Error).message);
          }
        })
      }
      className="inline-flex items-center gap-2 rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-black disabled:opacity-60"
    >
      <RotateCcw size={15} /> Reativar conta
    </button>
  );
}
