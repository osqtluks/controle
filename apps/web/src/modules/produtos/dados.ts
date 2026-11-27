import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { EventoHistorico, LoteSaldo, ProdutoEstoque } from "./tipos";

const FOTO_TTL = 60 * 60; // 1 h

/** Gera URLs assinadas (temporárias) para as fotos do bucket privado. */
async function comFotos<T extends { foto_path: string | null }>(itens: T[]) {
  const paths = itens.map((p) => p.foto_path).filter((p): p is string => Boolean(p));
  const urls = new Map<string, string>();
  if (paths.length) {
    const supabase = await createClient();
    const { data } = await supabase.storage.from("produtos").createSignedUrls(paths, FOTO_TTL);
    data?.forEach((d) => d.path && d.signedUrl && urls.set(d.path, d.signedUrl));
  }
  return itens.map((p) => ({ ...p, foto_url: p.foto_path ? (urls.get(p.foto_path) ?? null) : null }));
}

export type ProdutoComFoto = ProdutoEstoque & { foto_url: string | null };

export async function listarProdutos(incluirArquivados = false): Promise<ProdutoComFoto[]> {
  const supabase = await createClient();
  let q = supabase.from("produtos_estoque").select("*").order("nome");
  if (!incluirArquivados) q = q.eq("arquivado", false);
  const { data, error } = await q;
  if (error) throw new Error(`Não foi possível carregar os produtos: ${error.message}`);
  return comFotos((data ?? []) as ProdutoEstoque[]);
}

export async function obterProduto(id: string): Promise<ProdutoComFoto | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("produtos_estoque").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(`Não foi possível carregar o produto: ${error.message}`);
  if (!data) return null;
  const [p] = await comFotos([data as ProdutoEstoque]);
  return p ?? null;
}

export async function listarLotes(produtoId: string): Promise<LoteSaldo[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("lotes_saldo")
    .select("*, fornecedor:pessoas(nome)")
    .eq("produto_id", produtoId)
    .order("data_compra", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw new Error(`Não foi possível carregar as entradas: ${error.message}`);
  return (data ?? []) as LoteSaldo[];
}

export async function historicoDe(registroIds: string[], limite = 50): Promise<EventoHistorico[]> {
  if (!registroIds.length) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("historico")
    .select("id, acao, tabela, antes, depois, em")
    .in("registro_id", registroIds)
    .order("em", { ascending: false })
    .limit(limite);
  if (error) throw new Error(`Não foi possível carregar o histórico: ${error.message}`);
  return (data ?? []) as EventoHistorico[];
}

export async function listarCategorias(): Promise<string[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("produtos").select("categoria").not("categoria", "is", null);
  return [...new Set((data ?? []).map((r) => r.categoria as string))].sort((a, b) => a.localeCompare(b, "pt-BR"));
}
