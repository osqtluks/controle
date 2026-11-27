/** Ordenação genérica usada em todas as listas e tabelas. */
export type Direcao = "asc" | "desc";

const collator = new Intl.Collator("pt-BR", { sensitivity: "base", numeric: true });

type Valor = string | number | boolean | null | undefined | Date;

function comparar(a: Valor, b: Valor): number {
  // Vazios sempre no fim, independente da direção.
  const va = a === null || a === undefined || a === "";
  const vb = b === null || b === undefined || b === "";
  if (va || vb) return va === vb ? 0 : va ? 1 : -1;
  if (typeof a === "string" && typeof b === "string") return collator.compare(a, b);
  const na = a instanceof Date ? a.getTime() : Number(a);
  const nb = b instanceof Date ? b.getTime() : Number(b);
  return na - nb;
}

export function ordenar<T>(itens: readonly T[], chave: (x: T) => Valor, dir: Direcao): T[] {
  const sinal = dir === "asc" ? 1 : -1;
  return [...itens].sort((x, y) => {
    const a = chave(x);
    const b = chave(y);
    const vazio = a === null || a === undefined || a === "" || b === null || b === undefined || b === "";
    const c = comparar(a, b);
    return vazio ? c : c * sinal;
  });
}
