import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Pessoa } from "./tipos";

export type { Pessoa };

export async function listarPessoas(filtro?: "fornecedores" | "clientes"): Promise<Pessoa[]> {
  const supabase = await createClient();
  let q = supabase
    .from("pessoas")
    .select("id, nome, tipo, telefone, observacoes, created_at")
    .eq("arquivada", false)
    .order("nome");
  if (filtro === "fornecedores") q = q.in("tipo", ["fornecedor", "ambos"]);
  if (filtro === "clientes") q = q.in("tipo", ["cliente", "ambos"]);
  const { data, error } = await q;
  if (error) throw new Error(`Não foi possível carregar as pessoas: ${error.message}`);
  return (data ?? []) as Pessoa[];
}
