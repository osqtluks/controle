import { formatBRL } from "@ct/core";
import { formatData, formatDataHora } from "@/lib/datas";
import { FORMAS, type EventoConta, type Forma } from "../tipos";

function texto(e: EventoConta, tipo: "receber" | "pagar"): string {
  const d = e.dados as Record<string, unknown>;
  const r = (k: string) => formatBRL(Number(d[k] ?? 0));
  switch (e.tipo) {
    case "criada": {
      const n = Number(d.parcelas ?? 1);
      const origem = d.origem === "venda" ? " (venda no fiado)" : d.origem === "compra" ? " (compra a prazo)" : "";
      return `Conta criada${origem}: ${r("valor")}${n > 1 ? ` em ${n} parcelas` : ""}`;
    }
    case "pagamento": {
      const verbo = tipo === "receber" ? "recebeu" : "pagou";
      const forma = FORMAS[(d.forma as Forma) ?? "outro"] ?? "";
      const al = (d.alocacoes as { parcela: number; valor: number }[] | undefined) ?? [];
      const onde = al.length > 1 ? ` — ${al.map((a) => `${a.parcela}ª: ${formatBRL(a.valor)}`).join(", ")}` : "";
      const falta = Number(d.falta_depois ?? 0);
      return `Você ${verbo} ${r("valor")} (${forma}, ${formatData(String(d.data))})${onde} · ${falta > 0 ? `falta ${formatBRL(falta)}` : "quitada ✓"}${d.obs ? ` · ${d.obs}` : ""}`;
    }
    case "estorno":
      return `Você estornou o pagamento de ${r("valor")} de ${formatData(String(d.data))}`;
    case "pagamento_reativado":
      return `Você reativou o pagamento de ${r("valor")}`;
    case "remarcada": {
      const dias = Number(d.dias);
      const total = Number(d.total_desde_original);
      return `Você ${dias > 0 ? "postergou" : "antecipou"} a ${d.parcela}ª parcela de ${formatData(String(d.de))} para ${formatData(String(d.para))} (${dias > 0 ? "+" : ""}${dias} dias${total !== dias ? ` · ${total > 0 ? "+" : ""}${total} desde a original ${formatData(String(d.original))}` : ""})${d.motivo ? ` · motivo: ${d.motivo}` : ""}`;
    }
    case "data_definida":
      return `Você definiu o vencimento da ${d.parcela}ª parcela: ${formatData(String(d.para))}`;
    case "cancelada":
      return `Conta cancelada${d.motivo ? ` (${d.motivo})` : ""}`;
    case "reativada":
      return `Conta reativada${d.motivo ? ` (${d.motivo})` : ""}`;
  }
}

const COR: Partial<Record<EventoConta["tipo"], string>> = {
  pagamento: "bg-emerald-500",
  remarcada: "bg-violet-400",
  estorno: "bg-red-500",
  cancelada: "bg-red-500",
};

export function HistoricoConta({ eventos, tipo }: { eventos: EventoConta[]; tipo: "receber" | "pagar" }) {
  return (
    <ol className="space-y-0 divide-y divide-line/60">
      {eventos.map((e) => (
        <li key={e.id} className="flex gap-3 py-2 text-sm">
          <span className={`mt-1.5 size-2 shrink-0 rounded-full ${COR[e.tipo] ?? "bg-zinc-500"}`} />
          <div>
            <time className="text-[11px] tabular-nums text-faint">{formatDataHora(e.em)}</time>
            <p>{texto(e, tipo)}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}
