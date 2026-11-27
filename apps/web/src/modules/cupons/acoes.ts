"use server";

import { refresh } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type EstadoCupom = { erro?: string; ok?: boolean };

export async function criarCupom(_: EstadoCupom, f: FormData): Promise<EstadoCupom> {
  const codigo = String(f.get("codigo") ?? "").trim().toUpperCase();
  if (!/^[A-Z0-9][A-Z0-9_-]{1,29}$/.test(codigo))
    return { erro: "Código: de 2 a 30 letras/números, sem espaço (pode usar - e _)." };
  const pct = Number(String(f.get("percentual") ?? "").replace(",", "."));
  if (!Number.isFinite(pct) || pct <= 0 || pct > 100) return { erro: "Porcentagem entre 0 e 100." };
  const limiteTxt = String(f.get("limite_usos") ?? "").trim();
  const limite = limiteTxt ? Number(limiteTxt) : null;
  if (limite !== null && (!Number.isInteger(limite) || limite <= 0)) return { erro: "Limite de usos inválido." };
  const de = String(f.get("valido_de") ?? "") || null;
  const ate = String(f.get("valido_ate") ?? "") || null;
  if (de && ate && ate < de) return { erro: "A data final é antes da inicial." };

  const supabase = await createClient();
  const { error } = await supabase.from("cupons").insert({
    codigo,
    percentual_bps: Math.round(pct * 100),
    valido_de: de,
    valido_ate: ate,
    limite_usos: limite,
    descricao: String(f.get("descricao") ?? "").trim() || null,
  });
  if (error) return { erro: error.code === "23505" ? `Já existe um cupom ${codigo}.` : error.message };
  refresh();
  return { ok: true };
}

/** Desativar é a "exclusão" de cupom: dá para reativar a qualquer hora. */
export async function definirCupomAtivo(id: string, ativo: boolean) {
  const supabase = await createClient();
  const { error } = await supabase.from("cupons").update({ ativo }).eq("id", id);
  if (error) throw new Error(error.message);
  refresh();
}
