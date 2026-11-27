import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Cupom } from "./tipos";

export async function listarCupons(): Promise<Cupom[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("cupons_uso").select("*").order("created_at", { ascending: false });
  if (error) throw new Error(`Não foi possível carregar os cupons: ${error.message}`);
  return (data ?? []) as Cupom[];
}
