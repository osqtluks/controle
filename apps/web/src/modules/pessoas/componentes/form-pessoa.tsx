"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, X } from "lucide-react";
import { Botao, Campo, Erro, Input, Select, Textarea } from "@/components/ui/form";
import { cn } from "@/lib/cn";
import { criarPessoa, editarPessoa, type EstadoPessoa } from "../acoes";
import { DIAS_CURTOS, TIPO_PESSOA, type HorarioEntrega, type Pessoa } from "../tipos";

const ATALHOS: { rotulo: string; dias: number[] }[] = [
  { rotulo: "Seg–Sex", dias: [1, 2, 3, 4, 5] },
  { rotulo: "Fim de semana", dias: [0, 6] },
  { rotulo: "Todo dia", dias: [0, 1, 2, 3, 4, 5, 6] },
];

/** Faixas de horário para entrega: dias da semana + das/até. */
function Horarios({ valor, mudar }: { valor: HorarioEntrega[]; mudar: (h: HorarioEntrega[]) => void }) {
  const set = (i: number, h: Partial<HorarioEntrega>) => mudar(valor.map((x, k) => (k === i ? { ...x, ...h } : x)));
  return (
    <div className="space-y-2">
      {valor.map((h, i) => (
        <div key={i} className="space-y-2 rounded-lg border border-line bg-bg/50 p-2">
          <div className="flex flex-wrap items-center gap-1">
            {DIAS_CURTOS.map((d, k) => (
              <button
                key={d}
                type="button"
                onClick={() => set(i, { dias: h.dias.includes(k) ? h.dias.filter((x) => x !== k) : [...h.dias, k] })}
                className={cn(
                  "rounded-md border px-2 py-1 text-xs",
                  h.dias.includes(k) ? "border-accent/60 bg-accent/15 text-accent" : "border-line text-muted",
                )}
              >
                {d}
              </button>
            ))}
            <button type="button" onClick={() => mudar(valor.filter((_, k) => k !== i))} className="ml-auto p-1 text-red-400/80" title="Tirar">
              <X size={14} />
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
            {ATALHOS.map((a) => (
              <button key={a.rotulo} type="button" onClick={() => set(i, { dias: a.dias })} className="underline-offset-2 hover:underline">
                {a.rotulo}
              </button>
            ))}
            <span className="ml-auto flex items-center gap-1">
              das <Input type="time" value={h.de} onChange={(e) => set(i, { de: e.target.value })} className="w-28 py-1.5" />
              até <Input type="time" value={h.ate} onChange={(e) => set(i, { ate: e.target.value })} className="w-28 py-1.5" />
            </span>
          </div>
        </div>
      ))}
      <button
        type="button"
        onClick={() => mudar([...valor, { dias: [1, 2, 3, 4, 5], de: "18:00", ate: "22:00" }])}
        className="inline-flex items-center gap-1 rounded-lg border border-dashed border-line px-3 py-1.5 text-xs text-muted hover:text-fg"
      >
        <Plus size={13} /> Faixa de horário
      </button>
    </div>
  );
}

/** Cadastro e edição de pessoa. Sem `pessoa` = novo cadastro (fica no lado da lista). */
export function FormPessoa({
  pessoa,
  pessoas,
  hoje,
  compacto,
}: {
  pessoa?: Pessoa;
  pessoas: { id: string; nome: string }[];
  hoje: string;
  compacto?: boolean;
}) {
  const router = useRouter();
  const [horarios, setHorarios] = useState<HorarioEntrega[]>(pessoa?.horarios_entrega ?? []);
  const [indicadoPor, setIndicadoPor] = useState(pessoa?.indicado_por ?? "");
  const [mais, setMais] = useState(!!pessoa || !compacto);
  const [chave, setChave] = useState(0);
  const [estado, acao, enviando] = useActionState<EstadoPessoa, FormData>(async (antes, f) => {
    const r = await (pessoa ? editarPessoa : criarPessoa)(antes, f);
    if (r.ok && pessoa) router.push(`/pessoas/${pessoa.id}`);
    else if (r.ok) {
      // Limpa o formulário de cadastro para o próximo.
      setHorarios([]);
      setIndicadoPor("");
      setChave((k) => k + 1);
    }
    return r;
  }, {});

  const outras = pessoas.filter((p) => p.id !== pessoa?.id);

  return (
    <form key={chave} action={acao} className="space-y-3">
      {pessoa && <input type="hidden" name="id" value={pessoa.id} />}
      <input type="hidden" name="horarios_entrega" value={JSON.stringify(horarios)} />
      <div className="grid gap-3 sm:grid-cols-2">
        <Campo rotulo="Nome *">
          <Input name="nome" required maxLength={120} defaultValue={pessoa?.nome} />
        </Campo>
        <Campo rotulo="Apelido">
          <Input name="apelido" maxLength={60} defaultValue={pessoa?.apelido ?? ""} />
        </Campo>
        <Campo rotulo="Tipo">
          <Select name="tipo" defaultValue={pessoa?.tipo ?? "cliente"}>
            {Object.entries(TIPO_PESSOA).map(([v, r]) => (
              <option key={v} value={v}>
                {r}
              </option>
            ))}
          </Select>
        </Campo>
        <Campo rotulo="Telefone / WhatsApp">
          <Input name="telefone" type="tel" inputMode="tel" defaultValue={pessoa?.telefone ?? ""} />
        </Campo>
      </div>

      <div className="space-y-3 rounded-lg border border-violet-500/25 bg-violet-500/5 p-3">
        <Campo rotulo="Indicado por" dica="Quem trouxe essa pessoa. Conta no ranking de Indicações.">
          <Select name="indicado_por" value={indicadoPor} onChange={(e) => setIndicadoPor(e.target.value)}>
            <option value="">Ninguém / não sei</option>
            {outras.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nome}
              </option>
            ))}
          </Select>
        </Campo>
        {indicadoPor && (
          <Campo rotulo="Data da indicação">
            <Input name="indicado_em" type="date" max={hoje} defaultValue={pessoa?.indicado_em ?? hoje} />
          </Campo>
        )}
      </div>

      {!mais ? (
        <button type="button" onClick={() => setMais(true)} className="text-xs text-accent underline-offset-2 hover:underline">
          + Endereço, horários de entrega, aniversário…
        </button>
      ) : (
        <>
          <Campo rotulo="Endereço">
            <Textarea name="endereco" rows={2} maxLength={300} defaultValue={pessoa?.endereco ?? ""} />
          </Campo>
          <Campo rotulo="Ponto de referência / como chegar">
            <Input name="referencia" maxLength={200} defaultValue={pessoa?.referencia ?? ""} />
          </Campo>
          <div className="space-y-1">
            <span className="text-xs font-medium text-muted">Horários para entrega</span>
            <Horarios valor={horarios} mudar={setHorarios} />
          </div>
          <Campo rotulo="Aniversário">
            <Input name="aniversario" type="date" defaultValue={pessoa?.aniversario ?? ""} />
          </Campo>
          <Campo rotulo="Observações">
            <Textarea name="observacoes" rows={2} defaultValue={pessoa?.observacoes ?? ""} />
          </Campo>
        </>
      )}
      <Erro>{estado.erro}</Erro>
      {estado.ok && !pessoa && <p className="text-sm text-emerald-400">Salvo.</p>}
      <Botao disabled={enviando}>{enviando ? "Salvando…" : pessoa ? "Salvar alterações" : "Adicionar"}</Botao>
    </form>
  );
}
