import { formatGrams, type StockThresholds } from "@ct/core";

type Chave = keyof StockThresholds;

export const ROTULO_NIVEL: Record<Chave, string> = {
  cheio: "Cheio",
  metade: "Na metade",
  acabando: "Chegando ao fim",
  muitoBaixo: "Muito baixo",
  acabou: "Acabou",
};

/** Do menor para o maior: cada um precisa ser menor que o seguinte. */
const ORDEM: Chave[] = ["acabou", "muitoBaixo", "acabando", "metade", "cheio"];

/** Erros de ordem, por campo (o campo de baixo é o marcado). */
export function errosDeNivel(l: StockThresholds): Partial<Record<Chave, string>> {
  const erros: Partial<Record<Chave, string>> = {};
  for (let i = 0; i < ORDEM.length - 1; i++) {
    const baixo = ORDEM[i]!;
    const cima = ORDEM[i + 1]!;
    if (l[baixo] >= l[cima])
      erros[baixo] = `"${ROTULO_NIVEL[baixo]}" (${formatGrams(l[baixo])}) precisa ser menor que "${ROTULO_NIVEL[cima]}" (${formatGrams(l[cima])}).`;
  }
  return erros;
}

const FAIXAS: { de: Chave; ate: Chave; cor: string; rotulo: string }[] = [
  { de: "acabou", ate: "muitoBaixo", cor: "bg-red-500", rotulo: "Muito baixo" },
  { de: "muitoBaixo", ate: "acabando", cor: "bg-orange-500", rotulo: "Chegando ao fim" },
  { de: "acabando", ate: "metade", cor: "bg-amber-400", rotulo: "Na metade" },
  { de: "metade", ate: "cheio", cor: "bg-emerald-500", rotulo: "Bom → Cheio" },
];

/**
 * Régua única de 0 até "Cheio" mostrando em que faixa cada quantidade cai.
 * Ex.: com cheio 100, metade 50, fim 15, muito baixo 5: de 15 a 50 g a barra fica amarela.
 */
export function ReguaNiveis({ limites }: { limites: StockThresholds }) {
  const total = limites.cheio;
  if (total <= 0 || Object.keys(errosDeNivel(limites)).length) return null;
  const pct = (v: number) => `${(v / total) * 100}%`;

  return (
    <div className="space-y-1.5">
      <p className="text-[11px] text-faint">Como o estoque vai ser classificado (de 0 até cheio):</p>
      <div className="relative flex h-3 overflow-hidden rounded-full bg-zinc-700">
        <div className="bg-zinc-600" style={{ width: pct(limites.acabou) }} title="Acabou" />
        {FAIXAS.map((f) => (
          <div
            key={f.de}
            className={f.cor}
            style={{ width: pct(limites[f.ate] - limites[f.de]) }}
            title={`${f.rotulo}: até ${formatGrams(limites[f.ate])}`}
          />
        ))}
      </div>
      <div className="relative h-4 text-[10px] tabular-nums text-faint">
        {ORDEM.map((k) => (
          <span
            key={k}
            className="absolute -translate-x-1/2 whitespace-nowrap first:translate-x-0 last:-translate-x-full"
            style={{ left: pct(limites[k]) }}
          >
            {formatGrams(limites[k])}
          </span>
        ))}
      </div>
      <ul className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-[11px] text-muted sm:grid-cols-4">
        <li><span className="mr-1 inline-block size-2 rounded-full bg-red-500" />até {formatGrams(limites.muitoBaixo)}: muito baixo</li>
        <li><span className="mr-1 inline-block size-2 rounded-full bg-orange-500" />até {formatGrams(limites.acabando)}: chegando ao fim</li>
        <li><span className="mr-1 inline-block size-2 rounded-full bg-amber-400" />até {formatGrams(limites.metade)}: na metade</li>
        <li><span className="mr-1 inline-block size-2 rounded-full bg-emerald-500" />acima: bom / cheio</li>
      </ul>
    </div>
  );
}
