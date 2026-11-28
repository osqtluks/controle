import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import {
  BONUS_POSICAO_BPS,
  BONUS_SEMANA_BPS,
  bonusIndicacao,
  DIAS_INDICADO_ATIVO,
  formatBps,
  rankingIndicacoes,
  semanaDoMes,
} from "@ct/core";
import { Cabecalho, Carregando, Secao } from "@/components/ui/pagina";
import { hojeISO } from "@/lib/datas";
import { dadosIndicacoes } from "@/modules/pessoas/dados";
import { RankingIndicacoes } from "@/modules/pessoas/componentes/ranking-indicacoes";

export const metadata: Metadata = { title: "Indicações" };

async function Conteudo() {
  await connection();
  const hoje = hojeISO();
  const { base, vendas } = await dadosIndicacoes();
  const linhas = rankingIndicacoes(base, vendas, hoje).map((l) => ({ ...l, bonus: bonusIndicacao(l.id, base, vendas, hoje) }));
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
      <RankingIndicacoes linhas={linhas} />
      <aside className="space-y-4">
        <Secao titulo="Como funciona">
          <ul className="space-y-2 text-sm text-muted">
            <li>
              Conta quem você <b className="text-fg">indicou e continua comprando</b>: o indicado fica ativo se comprou nos últimos{" "}
              {DIAS_INDICADO_ATIVO} dias. Parou de comprar, quem indicou desce no ranking.
            </li>
            <li>
              <b className="text-fg">Só o top 3 ganha desconto</b>, que é a soma de duas partes:
            </li>
          </ul>
          <table className="mt-3 w-full text-sm">
            <tbody className="divide-y divide-line/60">
              {BONUS_POSICAO_BPS.map((b, i) => (
                <tr key={i}>
                  <td className="py-1.5 text-muted">Top {i + 1}</td>
                  <td className="py-1.5 text-right font-semibold">+{formatBps(b)}</td>
                </tr>
              ))}
              {BONUS_SEMANA_BPS.map((b, i) => (
                <tr key={`s${i}`}>
                  <td className="py-1.5 text-muted">
                    {i + 1}
                    {i === BONUS_SEMANA_BPS.length - 1 ? "ª semana ou mais" : "ª semana"} seguida no top 3
                  </td>
                  <td className="py-1.5 text-right font-semibold">+{formatBps(b)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-3 text-xs text-faint">
            Ex.: top 1 na 3ª semana seguida = {formatBps(BONUS_POSICAO_BPS[0]! + BONUS_SEMANA_BPS[2]!)}. As semanas contam dentro do mês
            (1–7, 8–14, 15–21, 22 em diante) e zeram se sair do top 3 ou virar o mês. Hoje é a {semanaDoMes(hoje)}ª semana.
          </p>
          <p className="mt-2 text-xs text-faint">Na Nova venda, o desconto aparece pronto para aplicar quando o cliente tem bônus.</p>
        </Secao>
      </aside>
    </div>
  );
}

export default function IndicacoesPage() {
  return (
    <div className="mx-auto max-w-6xl">
      <Cabecalho titulo="Indicações" sub="Quem mais trouxe clientes que continuam comprando, e o desconto de cada um." />
      <Suspense fallback={<Carregando linhas={2} />}>
        <Conteudo />
      </Suspense>
    </div>
  );
}
