import "server-only";
import { createClient } from "@/lib/supabase/server";
import { PREFS_MENU_PADRAO, type DescricaoVitrine, type PrefsMenu } from "./tipos";

export async function lerPrefsMenu(): Promise<PrefsMenu> {
  const supabase = await createClient();
  const { data } = await supabase.from("preferencias").select("menu").maybeSingle();
  return { ...PREFS_MENU_PADRAO, ...((data?.menu as Partial<PrefsMenu>) ?? {}) };
}

export async function listarDescricoes(): Promise<DescricaoVitrine[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("produto_descricoes").select("id, produto_id, texto").order("created_at");
  if (error) throw new Error(error.message);
  return (data ?? []) as DescricaoVitrine[];
}
