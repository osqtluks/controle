export interface Exclusao {
  id: string;
  tipo: "lixeira" | "definitiva" | "cancelada";
  entidade: "produto" | "venda";
  registro_id: string;
  nome: string;
  resumo: { entradas?: number; estoque_dg?: number; total_cents?: number };
  em: string;
  restaurado_em: string | null;
}

export type Situacao = "pode_voltar" | "restaurado" | "substituida";

/** Uma exclusão "na Lixeira" que depois virou definitiva não é mais restaurável por ela mesma. */
export function situacao(e: Exclusao, todas: Exclusao[]): Situacao {
  if (!e.restaurado_em) return "pode_voltar";
  if (e.tipo === "lixeira") {
    const fim = new Date(e.restaurado_em).getTime();
    const virouDefinitiva = todas.some(
      (o) => o.tipo === "definitiva" && o.registro_id === e.registro_id && Math.abs(new Date(o.em).getTime() - fim) < 5_000,
    );
    if (virouDefinitiva) return "substituida";
  }
  return "restaurado";
}
