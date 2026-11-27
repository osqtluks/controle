"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { parseBRL, parseGrams, validateThresholds } from "@ct/core";
import { createClient } from "@/lib/supabase/server";

export type EstadoForm = { erro?: string; ok?: boolean };

const texto = (f: FormData, k: string) => {
  const v = String(f.get(k) ?? "").trim();
  return v || null;
};

async function enviarFoto(foto: File, produtoId: string): Promise<string> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  const uid = auth?.claims?.sub;
  if (!uid) throw new Error("Sessão expirada. Entre de novo.");
  const ext = foto.type === "image/png" ? "png" : foto.type === "image/webp" ? "webp" : "jpg";
  const path = `${uid}/${produtoId}-${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from("produtos").upload(path, foto, { contentType: foto.type });
  if (error) throw new Error(`Falha ao enviar a foto: ${error.message}`);
  return path;
}

/** Cria (sem `id`) ou edita (com `id`) um produto. */
export async function salvarProduto(_: EstadoForm, f: FormData): Promise<EstadoForm> {
  const id = texto(f, "id");
  const nome = texto(f, "nome");
  if (!nome) return { erro: "Dê um nome ao produto." };

  const preco = parseBRL(String(f.get("preco") ?? ""));
  if (preco === null || preco < 0) return { erro: "Preço por grama inválido. Ex.: 12,50" };

  const g = (k: string) => parseGrams(String(f.get(k) ?? ""));
  const lim = {
    acabou: g("lim_acabou"),
    muitoBaixo: g("lim_muito_baixo"),
    acabando: g("lim_acabando"),
    metade: g("lim_metade"),
    cheio: g("lim_cheio"),
  };
  if (Object.values(lim).some((v) => v === null)) return { erro: "Preencha os 5 níveis em gramas (ex.: 2,5)." };
  const limites = lim as { [K in keyof typeof lim]: number };
  const erroLim = validateThresholds(limites);
  if (erroLim) return { erro: `Níveis de estoque: ${erroLim}.` };

  const linha = {
    nome,
    categoria: texto(f, "categoria"),
    descricao: texto(f, "descricao"),
    observacoes: texto(f, "observacoes"),
    preco_cents_por_grama: preco,
    lim_acabou_dg: limites.acabou,
    lim_muito_baixo_dg: limites.muitoBaixo,
    lim_acabando_dg: limites.acabando,
    lim_metade_dg: limites.metade,
    lim_cheio_dg: limites.cheio,
  };

  const supabase = await createClient();
  let produtoId = id;
  if (id) {
    const { error } = await supabase.from("produtos").update(linha).eq("id", id);
    if (error) return { erro: `Não foi possível salvar: ${error.message}` };
  } else {
    const { data, error } = await supabase.from("produtos").insert(linha).select("id").single();
    if (error) return { erro: `Não foi possível criar: ${error.message}` };
    produtoId = data.id as string;
  }

  const foto = f.get("foto");
  if (foto instanceof File && foto.size > 0 && produtoId) {
    try {
      const path = await enviarFoto(foto, produtoId);
      await supabase.from("produtos").update({ foto_path: path }).eq("id", produtoId);
    } catch (e) {
      return { erro: (e as Error).message };
    }
  }

  redirect(`/produtos/${produtoId}`);
}

export async function arquivarProduto(id: string, arquivado: boolean) {
  const supabase = await createClient();
  const { error } = await supabase.from("produtos").update({ arquivado }).eq("id", id);
  if (error) throw new Error(error.message);
  refresh();
}

/** Entrada de estoque (lote). À vista ou a prazo com vencimento. */
export async function darEntrada(_: EstadoForm, f: FormData): Promise<EstadoForm> {
  const produtoId = texto(f, "produto_id");
  if (!produtoId) return { erro: "Produto não informado." };

  const qtd = parseGrams(String(f.get("quantidade") ?? ""));
  if (!qtd || qtd <= 0) return { erro: "Quantidade inválida. Ex.: 25 ou 3,5" };

  const custo = parseBRL(String(f.get("custo_total") ?? ""));
  if (custo === null || custo < 0) return { erro: "Valor pago inválido. Ex.: 350,00" };

  const pagamento = f.get("pagamento") === "prazo" ? "prazo" : "avista";
  const vencimento = texto(f, "vencimento");
  if (pagamento === "prazo" && !vencimento) return { erro: "Compra a prazo precisa de data de vencimento." };

  const supabase = await createClient();
  const { error } = await supabase.from("lotes").insert({
    produto_id: produtoId,
    fornecedor_id: texto(f, "fornecedor_id"),
    data_compra: texto(f, "data_compra") ?? undefined,
    quantidade_dg: qtd,
    custo_total_cents: custo,
    pagamento,
    vencimento: pagamento === "prazo" ? vencimento : null,
    observacoes: texto(f, "observacoes"),
  });
  if (error) return { erro: `Não foi possível registrar a entrada: ${error.message}` };

  refresh();
  return { ok: true };
}
