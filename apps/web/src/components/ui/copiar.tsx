"use client";

import { useState } from "react";
import { Check, Copy, MessageCircle } from "lucide-react";
import { toast } from "sonner";

/** Só os dígitos, com 55 na frente quando falta (para o link do WhatsApp). */
function numeroWhats(tel: string): string | null {
  const d = tel.replace(/\D/g, "");
  if (d.length < 10) return null;
  return d.length <= 11 ? `55${d}` : d;
}

/** Mensagem pronta: botão copiar e, se tiver telefone, abrir no WhatsApp. */
export function MensagemPronta({ titulo, texto, telefone }: { titulo: string; texto: string; telefone: string | null }) {
  const [copiado, setCopiado] = useState(false);
  const whats = telefone ? numeroWhats(telefone) : null;
  async function copiar() {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      toast.error("Não consegui copiar. Selecione o texto e copie na mão.");
    }
  }
  return (
    <div className="space-y-2 rounded-xl border border-emerald-500/25 bg-emerald-500/5 p-3">
      <div className="text-xs font-semibold text-emerald-300">{titulo}</div>
      <p className="whitespace-pre-line text-sm">{texto}</p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={copiar}
          className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-black"
        >
          {copiado ? <Check size={14} /> : <Copy size={14} />} {copiado ? "Copiado!" : "Copiar mensagem"}
        </button>
        {whats && (
          <a
            href={`https://wa.me/${whats}?text=${encodeURIComponent(texto)}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-xs"
          >
            <MessageCircle size={14} /> Abrir no WhatsApp
          </a>
        )}
      </div>
    </div>
  );
}
