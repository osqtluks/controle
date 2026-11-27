import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Exclusao } from "./tipos";

export async function listarExclusoes(): Promise<Exclusao[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("exclusoes")
    .select("id, tipo, entidade, registro_id, nome, resumo, em, restaurado_em")
    .order("em", { ascending: false })
    .limit(500);
  if (error) throw new Error(`Não foi possível carregar as exclusões: ${error.message}`);
  return (data ?? []) as Exclusao[];
}
