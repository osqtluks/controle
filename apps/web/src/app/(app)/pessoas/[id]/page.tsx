import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { Cake, Clock, Gift, MapPin, Pencil, ShoppingCart, Trophy, UserPlus } from "lucide-react";
import {
  BRINDE_NA_COMPRA_DO_MES,
  bonusIndicacao,
  brindeDoMes,
  conquistas,
  descreverBonus,
  diasEntre,
  formatBps,
  formatBRL,
  formatGrams,
  perfilCliente,
  rankingIndicacoes,
  ROTULO_STATUS,
  type TipoConquista,
} from "@ct/core";
import { Cabecalho, Carregando, linkBotao, linkBotaoSec, Secao } from "@/components/ui/pagina";
import { cn } from "@/lib/cn";
import { formatData, hojeISO } from "@/lib/datas";
import { listarProdutos } from "@/modules/produtos/dados";
import { dadosIndicacoes } from "@/modules/pessoas/dados";
import { ComprasCliente } from "@/modules/pessoas/componentes/compras-cliente";
import { FormBrinde } from "@/modules/pessoas/componentes/form-brinde";
import { ProgressoBrinde } from "@/modules/pessoas/componentes/lista-pessoas";
import { COR_STATUS, descreverHorario, TIPO_PESSOA } from "@/modules/pessoas/tipos";

export const metadata: Metadata = { title: "Pessoa" };

const ICONE: Record<TipoConquista, string> = {
  primeira: "🌱",
  marco: "🏅",
  semana: "⚡",
  mes: "📅",
  premio: "🎁",
  brinde: "🎀",
  indicacao: "🤝",
  retorno: "🔁",
};

const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

/** Dias até o próximo aniversário (0 = hoje). */
function diasAteAniversario(aniv: string, hoje: string): number {
  const md = aniv.slice(5);
  let alvo = `${hoje.slice(0, 4)}-${md === "02-29" ? "02-28" : md}`;
  if (alvo < hoje) alvo = `${Number(hoje.slice(0, 4)) + 1}-${md === "02-29" ? "02-28" : md}`;
  return diasEntre(hoje, alvo);
}

function Numero({ rotulo, valor, sub, cor }: { rotulo: string; valor: string; sub?: string; cor?: string }) {
  return (
    <div className="rounded-xl border border-line bg-card p-3">
      <div className="text-[11px] text-faint">{rotulo}</div>
      <div className={cn("truncate text-lg font-semibold tabular-nums", cor)}>{valor}</div>
      {sub && <div className="truncate text-[11px] text-muted">{sub}</div>}
    </div>
  );
}

async function Detalhe({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await connection();
  const hoje = hojeISO();
  const [{ pessoas, base, vendas, compras }, produtos] = await Promise.all([dadosIndicacoes(), listarProdutos()]);
  const p = pessoas.find((x) => x.id === id);
  if (!p) notFound();

  const cs = compras.get(p.id) ?? [];
  const perfil = perfilCliente(cs, hoje);
  const brinde = brindeDoMes(cs, hoje);
  const ranking = rankingIndicacoes(base, vendas, hoje);
  const minha = ranking.find((l) => l.id === p.id);
  const bonus = bonusIndicacao(p.id, base, vendas, hoje);
  const indicador = p.indicado_por ? pessoas.find((x) => x.id === p.indicado_por) : null;
  const indicou = pessoas.filter((x) => x.indicado_por === p.id);
  const lista = conquistas(
    cs,
    indicou.map((x) => ({ nome: x.nome, data: x.indicado_em ?? x.created_at.slice(0, 10) })),
  );
  const comEstoque = produtos.filter((x) => x.estoque_dg > 0).map((x) => ({ id: x.id, nome: x.nome, estoque_dg: x.estoque_dg }));
  const cliente = p.tipo !== "fornecedor";
  const aniv = p.aniversario ? diasAteAniversario(p.aniversario, hoje) : null;
  const mes = MESES[Number(hoje.slice(5, 7)) - 1];

  return (
    <>
      <Cabecalho
        titulo={p.nome}
        sub={[p.apelido && `“${p.apelido}”`, TIPO_PESSOA[p.tipo], p.telefone].filter(Boolean).join(" · ")}
        voltar="/pessoas"
        acoes={
          <>
            {cliente && (
              <Link href={`/vendas/nova?cliente=${p.id}`} className={linkBotao}>
                <ShoppingCart size={16} /> Nova venda
              </Link>
            )}
            <Link href={`/pessoas/${p.id}/editar`} className={linkBotaoSec}>
              <Pencil size={15} /> Editar
            </Link>
          </>
        }
      />

      {cliente && (
        <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Numero
            rotulo="Situação"
            valor={ROTULO_STATUS[perfil.status]}
            cor={COR_STATUS[perfil.status].split(" ")[1]}
            sub={
              perfil.diasSemComprar === null
                ? "nunca comprou"
                : perfil.diasSemComprar === 0
                  ? "comprou hoje"
                  : `${perfil.diasSemComprar} dia(s) sem comprar`
            }
          />
          <Numero rotulo="Compras" valor={String(perfil.compras)} sub={`${perfil.comprasNoMes} no mês · ${perfil.comprasNaSemana} na semana`} />
          <Numero rotulo="Já gastou" valor={formatBRL(perfil.gastoCents)} sub={`ticket médio ${formatBRL(perfil.ticketMedioCents)}`} />
          <Numero rotulo="Gramas compradas" valor={formatGrams(perfil.gramasDg)} sub={perfil.favorito ? `prefere ${perfil.favorito.produto}` : undefined} />
          <Numero rotulo="Primeira compra" valor={formatData(perfil.primeira)} sub={perfil.ultima ? `última ${formatData(perfil.ultima)}` : undefined} />
          <Numero
            rotulo="Compra a cada"
            valor={perfil.intervaloMedio !== null ? `${perfil.intervaloMedio} dia(s)` : "—"}
            sub={perfil.previsaoProxima ? `deve voltar ~${formatData(perfil.previsaoProxima)}` : "precisa de 2 compras"}
          />
          <Numero rotulo="Brindes recebidos" valor={String(perfil.brindes)} />
          <Numero
            rotulo="Bônus de indicação"
            valor={bonus.totalBps ? formatBps(bonus.totalBps) : "—"}
            cor={bonus.totalBps ? "text-violet-300" : undefined}
            sub={minha?.posicao ? `${minha.posicao}º no ranking` : indicou.length ? "fora do ranking" : "não indicou ninguém"}
          />
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-4">
          {cliente && (
            <Secao titulo={`Brinde de ${mes}`} acoes={<ProgressoBrinde b={brinde} />}>
              <p className="mb-3 text-sm">
                {brinde.entregue ? (
                  <span className="text-emerald-300">Já recebeu o brinde deste mês. ✔</span>
                ) : brinde.ganhou ? (
                  <span className="font-semibold text-amber-300">
                    <Gift size={14} className="mr-1 inline" />
                    Ganhou brinde ({brinde.comprasNoMes} compras no mês). Escolha o que dar:
                  </span>
                ) : (
                  <span className="text-muted">
                    {brinde.comprasNoMes} de {BRINDE_NA_COMPRA_DO_MES} compras no mês. Faltam {brinde.faltam} para ganhar brinde.
                  </span>
                )}
              </p>
              <FormBrinde clienteId={p.id} produtos={comEstoque} sugestao={`brinde da ${BRINDE_NA_COMPRA_DO_MES}ª compra de ${mes}`} />
            </Secao>
          )}

          <Secao titulo="Indicações">
            <div className="space-y-3 text-sm">
              <div className="flex items-center gap-2">
                <span className="text-muted">Indicado por ›</span>
                {indicador ? (
                  <Link href={`/pessoas/${indicador.id}`} className="font-medium text-violet-300 hover:underline">
                    {indicador.nome}
                  </Link>
                ) : (
                  <span className="text-faint">ninguém</span>
                )}
                {p.indicado_em && <span className="text-xs text-faint">em {formatData(p.indicado_em)}</span>}
              </div>
              <div>
                <div className="mb-1 flex items-center gap-2">
                  <span className="text-muted">Indicou ›</span>
                  <span className="font-medium">
                    {indicou.length} pessoa(s){minha ? ` · ${minha.ativos} ativa(s)` : ""}
                  </span>
                  {minha?.posicao && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-400/15 px-2 py-0.5 text-[11px] font-bold text-amber-300">
                      <Trophy size={11} /> {minha.posicao}º
                    </span>
                  )}
                </div>
                {minha && minha.indicados.length > 0 && (
                  <ul className="divide-y divide-line/60 rounded-lg border border-line">
                    {minha.indicados.map((x) => (
                      <li key={x.id} className="flex items-center justify-between gap-2 px-3 py-2">
                        <Link href={`/pessoas/${x.id}`} className="truncate hover:underline">
                          {x.nome}
                        </Link>
                        <span className={cn("shrink-0 text-xs", x.ativo ? "text-emerald-300" : "text-orange-300")}>
                          {x.ultimaCompra
                            ? `${x.ativo ? "ativo" : "parado"} · comprou ${formatData(x.ultimaCompra)}`
                            : "ainda não comprou"}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              {bonus.totalBps > 0 && (
                <p className="rounded-lg bg-violet-500/10 px-3 py-2 text-xs text-violet-200">
                  Desconto atual de {formatBps(bonus.totalBps)}: {descreverBonus(bonus)}.
                </p>
              )}
              <Link href="/indicacoes" className="inline-flex items-center gap-1 text-xs text-accent hover:underline">
                <UserPlus size={13} /> Ver ranking de indicações
              </Link>
            </div>
          </Secao>

          <Secao titulo="Entrega e dados">
            <dl className="space-y-2 text-sm">
              <div className="flex gap-2">
                <MapPin size={15} className="mt-0.5 shrink-0 text-muted" />
                <div>
                  <div className="whitespace-pre-line">{p.endereco || <span className="text-faint">sem endereço</span>}</div>
                  {p.referencia && <div className="text-xs text-muted">{p.referencia}</div>}
                </div>
              </div>
              <div className="flex gap-2">
                <Clock size={15} className="mt-0.5 shrink-0 text-muted" />
                <div>
                  {p.horarios_entrega.length ? (
                    p.horarios_entrega.map((h, i) => <div key={i}>{descreverHorario(h)}</div>)
                  ) : (
                    <span className="text-faint">sem horários de entrega</span>
                  )}
                </div>
              </div>
              <div className="flex gap-2">
                <Cake size={15} className="mt-0.5 shrink-0 text-muted" />
                <div>
                  {p.aniversario ? (
                    <>
                      {formatData(p.aniversario).slice(0, 5)}
                      <span className={cn("ml-2 text-xs", aniv !== null && aniv <= 7 ? "font-semibold text-amber-300" : "text-muted")}>
                        {aniv === 0 ? "é hoje! 🎉" : `faltam ${aniv} dia(s)`}
                      </span>
                    </>
                  ) : (
                    <span className="text-faint">sem aniversário</span>
                  )}
                </div>
              </div>
              {p.observacoes && <p className="whitespace-pre-line rounded-lg bg-bg/60 p-2 text-xs text-muted">{p.observacoes}</p>}
            </dl>
          </Secao>
        </div>

        <div className="space-y-4">
          <Secao titulo="Conquistas">
            {lista.length === 0 ? (
              <p className="text-sm text-muted">Nada ainda. A primeira compra já vira conquista.</p>
            ) : (
              <ol className="relative space-y-3 border-l border-line pl-4">
                {lista.map((c, i) => (
                  <li key={i} className="relative">
                    <span className="absolute -left-[26px] top-0 grid size-5 place-items-center rounded-full bg-card text-xs">
                      {ICONE[c.tipo]}
                    </span>
                    <div className={cn("text-sm", (c.tipo === "premio" || c.tipo === "brinde") && "font-semibold text-amber-300")}>
                      {c.texto}
                    </div>
                    <div className="text-[11px] text-faint">{formatData(c.data)}</div>
                  </li>
                ))}
              </ol>
            )}
          </Secao>
          {cliente && (
            <Secao titulo="Compras">
              <ComprasCliente compras={cs} />
            </Secao>
          )}
        </div>
      </div>
    </>
  );
}

export default function PessoaPage({ params }: PageProps<"/pessoas/[id]">) {
  return (
    <div className="mx-auto max-w-6xl">
      <Suspense fallback={<Carregando linhas={4} />}>
        <Detalhe params={params} />
      </Suspense>
    </div>
  );
}
