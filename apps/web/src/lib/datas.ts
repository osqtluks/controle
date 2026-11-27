/** Datas "puras" (YYYY-MM-DD) do banco, tratadas sem fuso para não pular um dia. */
export function formatData(iso: string | null | undefined): string {
  if (!iso) return "—";
  const [a, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${a}`;
}

export function formatDataHora(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

/** Dias de hoje até a data (negativo = já passou). */
export function diasAte(iso: string, hoje = new Date()): number {
  const [a, m, d] = iso.slice(0, 10).split("-").map(Number);
  const alvo = Date.UTC(a!, m! - 1, d!);
  const base = Date.UTC(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
  return Math.round((alvo - base) / 86_400_000);
}

export function hojeISO(hoje = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${hoje.getFullYear()}-${p(hoje.getMonth() + 1)}-${p(hoje.getDate())}`;
}
