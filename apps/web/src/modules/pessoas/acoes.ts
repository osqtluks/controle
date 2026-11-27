"use server";

import { refresh } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type EstadoPessoa = { erro?: string; ok?: boolean };

export async function criarPessoa(_: EstadoPessoa, f: FormData): Promise<EstadoPessoa> {
  const nome = String(f.get("nome") ?? "").trim();
  if (!nome) return { erro: "Informe o nome." };
  const tipo = String(f.get("tipo") ?? "cliente");
  if (!["cliente", "fornecedor", "ambos"].includes(tipo)) return { erro: "Tipo inválido." };

  const supabase = await createClient();
  const { error } = await supabase.from("pessoas").insert({
    nome,
    tipo,
    telefone: String(f.get("telefone") ?? "").trim() || null,
    observacoes: String(f.get("observacoes") ?? "").trim() || null,
  });
  if (error) return { erro: `Não foi possível salvar: ${error.message}` };
  refresh();
  return { ok: true };
}
