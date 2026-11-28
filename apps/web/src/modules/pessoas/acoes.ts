"use server";

import { refresh } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { HorarioEntrega } from "./tipos";

export type EstadoPessoa = { erro?: string; ok?: boolean; id?: string };

const texto = (f: FormData, k: string, max: number) => String(f.get(k) ?? "").trim().slice(0, max) || null;
const HORA = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Lê o formulário de pessoa (cadastro e edição usam o mesmo). */
function lerPessoa(f: FormData) {
  const nome = String(f.get("nome") ?? "").trim();
  if (!nome) return { erro: "Informe o nome." };
  const tipo = String(f.get("tipo") ?? "cliente");
  if (!["cliente", "fornecedor", "ambos"].includes(tipo)) return { erro: "Tipo inválido." };

  let horarios: HorarioEntrega[] = [];
  try {
    const bruto = JSON.parse(String(f.get("horarios_entrega") || "[]")) as HorarioEntrega[];
    horarios = bruto
      .map((h) => ({ dias: [...new Set(h.dias.map(Number))].filter((d) => d >= 0 && d <= 6).sort(), de: h.de, ate: h.ate }))
      .filter((h) => h.dias.length);
  } catch {
    return { erro: "Horários de entrega inválidos." };
  }
  if (horarios.some((h) => !HORA.test(h.de) || !HORA.test(h.ate))) return { erro: "Horário inválido (use 18:00)." };
  if (horarios.some((h) => h.de >= h.ate)) return { erro: "No horário de entrega, o início tem que ser antes do fim." };

  const indicado_por = texto(f, "indicado_por", 40);
  return {
    dados: {
      nome: nome.slice(0, 120),
      tipo,
      apelido: texto(f, "apelido", 60),
      telefone: texto(f, "telefone", 40),
      observacoes: texto(f, "observacoes", 2000),
      endereco: texto(f, "endereco", 300),
      referencia: texto(f, "referencia", 200),
      horarios_entrega: horarios,
      aniversario: texto(f, "aniversario", 10),
      indicado_por,
      indicado_em: indicado_por ? texto(f, "indicado_em", 10) : null,
    },
  };
}

export async function criarPessoa(_: EstadoPessoa, f: FormData): Promise<EstadoPessoa> {
  const r = lerPessoa(f);
  if ("erro" in r) return { erro: r.erro };
  const supabase = await createClient();
  const { data, error } = await supabase.from("pessoas").insert(r.dados).select("id").single();
  if (error) return { erro: `Não foi possível salvar: ${error.message}` };
  refresh();
  return { ok: true, id: data.id };
}

export async function editarPessoa(_: EstadoPessoa, f: FormData): Promise<EstadoPessoa> {
  const id = String(f.get("id") ?? "");
  const r = lerPessoa(f);
  if ("erro" in r) return { erro: r.erro };
  if (r.dados.indicado_por === id) return { erro: "A pessoa não pode ter indicado a si mesma." };
  const supabase = await createClient();
  const { error } = await supabase.from("pessoas").update(r.dados).eq("id", id);
  if (error) return { erro: `Não foi possível salvar: ${error.message}` };
  refresh();
  return { ok: true, id };
}

/** Cadastro rápido de pessoa (só o nome), usado nos seletores. */
export async function criarPessoaRapida(
  nome: string,
  tipo: "cliente" | "fornecedor" = "fornecedor",
): Promise<{ id: string; nome: string } | { erro: string }> {
  const n = nome.trim();
  if (!n) return { erro: "Informe o nome." };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("pessoas")
    .insert({ nome: n, tipo })
    .select("id, nome")
    .single();
  if (error) return { erro: `Não foi possível cadastrar: ${error.message}` };
  return data as { id: string; nome: string };
}
