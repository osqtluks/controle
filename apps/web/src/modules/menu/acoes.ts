"use server";

import { refresh } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { PrefsMenu } from "./tipos";

export async function salvarPrefsMenu(menu: PrefsMenu) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  const uid = auth?.claims?.sub;
  if (!uid) throw new Error("Sessão expirada.");
  const limpo: PrefsMenu = {
    titulo: menu.titulo.trim().slice(0, 60),
    subtitulo: menu.subtitulo.trim().slice(0, 120),
    mostrar_estoque: !!menu.mostrar_estoque,
  };
  const { error } = await supabase
    .from("preferencias")
    .upsert({ owner_id: uid, menu: limpo, updated_at: new Date().toISOString() });
  if (error) throw new Error(error.message);
  refresh();
}
