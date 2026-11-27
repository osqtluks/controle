/**
 * Tudo no horário de Brasília, independente de onde o servidor roda (a Vercel usa UTC).
 * Datas "puras" do banco (YYYY-MM-DD) são tratadas sem fuso para não pular um dia.
 */
export const FUSO = "America/Sao_Paulo";

export function formatData(iso: string | null | undefined): string {
  if (!iso) return "—";
  const [a, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${a}`;
}

/** Timestamp → "27/11/2026 14:32" no horário de Brasília. */
export function formatDataHora(iso: string): string {
  return new Date(iso)
    .toLocaleString("pt-BR", {
      timeZone: FUSO,
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
    .replace(",", "");
}

/** "Hoje" em Brasília, como YYYY-MM-DD. */
export function hojeISO(agora = new Date()): string {
  return agora.toLocaleDateString("en-CA", { timeZone: FUSO }); // en-CA = YYYY-MM-DD
}

/** Dias de hoje (em Brasília) até a data (negativo = já passou). */
export function diasAte(iso: string, agora = new Date()): number {
  const utc = (s: string) => {
    const [a, m, d] = s.slice(0, 10).split("-").map(Number);
    return Date.UTC(a!, m! - 1, d!);
  };
  return Math.round((utc(iso) - utc(hojeISO(agora))) / 86_400_000);
}
