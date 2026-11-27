"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { formatBRL, gerarParcelas, parseBRL, type Intervalo } from "@ct/core";
import { Botao, Campo, Erro, Input, Textarea } from "@/components/ui/form";
import { cn } from "@/lib/cn";
import { hojeISO } from "@/lib/datas";
import { SeletorFornecedor, type OpcaoFornecedor } from "@/modules/pessoas/componentes/seletor-fornecedor";
import { centsParaTexto } from "@/modules/produtos/componentes/campos-preco";
import { criarConta } from "../acoes";

export function FormConta({ pessoas }: { pessoas: OpcaoFornecedor[] }) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  const hoje = hojeISO();
  const [tipo, setTipo] = useState<"receber" | "pagar">("receber");
  const [pessoa, setPessoa] = useState<string | null>(null);
  const [descricao, setDescricao] = useState("");
  const [valor, setValor] = useState("");
  const [modo, setModo] = useState<"livre" | "fixas">("livre");
  const [vencimento, setVencimento] = useState("");
  const [n, setN] = useState(2);
  const [primeiro, setPrimeiro] = useState(hoje);
  const [intervalo, setIntervalo] = useState<Intervalo>("mensal");
  const [ajustes, setAjustes] = useState<Record<number, { valor?: string; vencimento?: string }>>({});
  const [obs, setObs] = useState("");
  const [erro, setErro] = useState<string | null>(null);

  const total = parseBRL(valor);
  const plano = useMemo(() => {
    if (modo !== "fixas" || !total || total <= 0 || !primeiro) return [];
    try {
      return gerarParcelas(total, n, primeiro, intervalo);
    } catch {
      return [];
    }
  }, [modo, total, n, primeiro, intervalo]);
  const linhas = plano.map((p) => ({
    numero: p.numero,
    valor: ajustes[p.numero]?.valor ?? centsParaTexto(p.valorCents),
    vencimento: ajustes[p.numero]?.vencimento ?? p.vencimento,
  }));
  const somaAjustada = linhas.reduce((s, l) => s + (parseBRL(l.valor) ?? 0), 0);
  const ajustado = Object.keys(ajustes).length > 0;

  function salvar() {
    setErro(null);
    iniciar(async () => {
      const r = await criarConta({
        tipo,
        pessoa_id: pessoa,
        descricao,
        observacoes: obs,
        valor,
        modo,
        vencimento,
        parcelas: n,
        primeiro,
        intervalo,
        ajustadas: ajustado ? linhas.map((l) => ({ valor: l.valor, vencimento: l.vencimento })) : undefined,
      });
      if ("erro" in r) return setErro(r.erro);
      toast.success("Conta criada.");
      router.push(`/contas/${r.id}`);
    });
  }

  const botaoTipo = (t: "receber" | "pagar") =>
    cn(
      "rounded-md py-2.5 text-sm",
      tipo === t ? (t === "receber" ? "bg-emerald-500/15 font-semibold text-emerald-300" : "bg-sky-500/15 font-semibold text-sky-300") : "text-muted",
    );

  return (
    <div className="space-y-4">
      <section className="space-y-3 rounded-xl border border-line bg-card p-4">
        <div className="grid grid-cols-2 gap-1 rounded-lg border border-line bg-bg p-1">
          <button type="button" onClick={() => setTipo("receber")} className={botaoTipo("receber")}>
            Me devem (a receber)
          </button>
          <button type="button" onClick={() => setTipo("pagar")} className={botaoTipo("pagar")}>
            Eu devo (a pagar)
          </button>
        </div>
        <Campo rotulo={tipo === "receber" ? "Quem te deve" : "Para quem você deve"}>
          <SeletorFornecedor
            key={tipo}
            tipoNovo={tipo === "receber" ? "cliente" : "fornecedor"}
            fornecedores={pessoas}
            valor={pessoa}
            aoMudar={setPessoa}
          />
        </Campo>
        <div className="grid gap-3 sm:grid-cols-[1fr_180px]">
          <Campo rotulo="Descrição *">
            <Input value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="ex.: empréstimo, aluguel, acerto…" maxLength={200} />
          </Campo>
          <Campo rotulo="Valor total (R$) *">
            <Input inputMode="decimal" value={valor} onChange={(e) => { setValor(e.target.value); setAjustes({}); }} placeholder="0,00" />
          </Campo>
        </div>
      </section>

      <section className="space-y-3 rounded-xl border border-line bg-card p-4">
        <div className="grid grid-cols-2 gap-1 rounded-lg border border-line bg-bg p-1 text-sm">
          {(["livre", "fixas"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setModo(m)}
              className={cn("rounded-md py-2", modo === m ? "bg-hover font-medium text-fg" : "text-muted")}
            >
              {m === "livre" ? "Valor livre" : "Parcelas fixas"}
            </button>
          ))}
        </div>

        {modo === "livre" ? (
          <>
            <p className="text-xs text-muted">Paga quando e quanto der. Cada pagamento abate do total.</p>
            <Campo rotulo="Combinado para (opcional)">
              <Input type="date" value={vencimento} onChange={(e) => setVencimento(e.target.value)} />
            </Campo>
          </>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-2">
              <Campo rotulo="Parcelas">
                <Input
                  type="number"
                  min={2}
                  max={120}
                  value={n}
                  onChange={(e) => { setN(Math.max(1, Math.min(120, Number(e.target.value) || 1))); setAjustes({}); }}
                />
              </Campo>
              <Campo rotulo="1ª parcela">
                <Input type="date" value={primeiro} onChange={(e) => { setPrimeiro(e.target.value); setAjustes({}); }} />
              </Campo>
              <Campo rotulo="A cada">
                <select
                  value={intervalo}
                  onChange={(e) => { setIntervalo(e.target.value as Intervalo); setAjustes({}); }}
                  className="w-full rounded-lg border border-line bg-bg px-3 py-2.5 text-sm outline-none focus:border-accent"
                >
                  <option value="mensal">Mês</option>
                  <option value="quinzenal">15 dias</option>
                  <option value="semanal">Semana</option>
                </select>
              </Campo>
            </div>
            {linhas.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-[11px] text-faint">Dá para ajustar valor e data de cada parcela.</p>
                {linhas.map((l) => (
                  <div key={l.numero} className="grid grid-cols-[2rem_1fr_1fr] items-center gap-2">
                    <span className="text-xs text-muted">{l.numero}ª</span>
                    <Input
                      inputMode="decimal"
                      value={l.valor}
                      onChange={(e) => setAjustes((a) => ({ ...a, [l.numero]: { ...a[l.numero], valor: e.target.value } }))}
                      className="py-1.5"
                    />
                    <Input
                      type="date"
                      value={l.vencimento}
                      onChange={(e) => setAjustes((a) => ({ ...a, [l.numero]: { ...a[l.numero], vencimento: e.target.value } }))}
                      className="py-1.5"
                    />
                  </div>
                ))}
                {ajustado && total && somaAjustada !== total && (
                  <p className="text-xs text-red-400">
                    As parcelas somam {formatBRL(somaAjustada)}, mas o total é {formatBRL(total)}.
                  </p>
                )}
              </div>
            )}
          </>
        )}
      </section>

      <section className="rounded-xl border border-line bg-card p-4">
        <Campo rotulo="Observações">
          <Textarea rows={2} value={obs} onChange={(e) => setObs(e.target.value)} />
        </Campo>
      </section>

      <Erro>{erro}</Erro>
      <Botao onClick={salvar} disabled={pendente || !total || !descricao.trim()}>
        {pendente ? "Salvando…" : "Criar conta"}
      </Botao>
    </div>
  );
}
