import "server-only";
import { createClient } from "@/lib/supabase/server";
import { PREFS_MENU_PADRAO, type PrefsMenu } from "./tipos";

export async function lerPrefsMenu(): Promise<PrefsMenu> {
  const supabase = await createClient();
  const { data } = await supabase.from("preferencias").select("menu").maybeSingle();
  return { ...PREFS_MENU_PADRAO, ...((data?.menu as Partial<PrefsMenu>) ?? {}) };
}
