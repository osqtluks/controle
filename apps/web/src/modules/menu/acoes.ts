"use server";

import { refresh } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { DescricaoVitrine, PrefsMenu } from "./tipos";

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

// ── Descrições vitrine ──

/** Cria uma descrição vitrine e já deixa ela escolhida no Menu. */
export async function criarDescricao(produtoId: string, texto: string): Promise<DescricaoVitrine | { erro: string }> {
  const t = texto.trim();
  if (!t) return { erro: "Escreva a descrição." };
  if (t.length > 400) return { erro: "No máximo 400 letras." };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("produto_descricoes")
    .insert({ produto_id: produtoId, texto: t })
    .select("id, produto_id, texto")
    .single();
  if (error) return { erro: error.message };
  await supabase.from("produtos").update({ menu_descricao_id: data.id, menu_sem_descricao: false }).eq("id", produtoId);
  refresh();
  return data as DescricaoVitrine;
}

export async function editarDescricao(id: string, texto: string) {
  const t = texto.trim();
  if (!t || t.length > 400) throw new Error("Descrição vazia ou longa demais (até 400 letras).");
  const supabase = await createClient();
  const { error } = await supabase.from("produto_descricoes").update({ texto: t }).eq("id", id);
  if (error) throw new Error(error.message);
  refresh();
}

/** Apaga a vitrine. O Menu volta para a padrão. "Desfazer" usa recriarDescricao. */
export async function excluirDescricao(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("produto_descricoes").delete().eq("id", id);
  if (error) throw new Error(error.message);
  refresh();
}

export async function recriarDescricao(d: DescricaoVitrine, escolhida: boolean) {
  const supabase = await createClient();
  const { error } = await supabase.from("produto_descricoes").insert({ id: d.id, produto_id: d.produto_id, texto: d.texto });
  if (error) throw new Error(error.message);
  if (escolhida) await supabase.from("produtos").update({ menu_descricao_id: d.id }).eq("id", d.produto_id);
  refresh();
}
