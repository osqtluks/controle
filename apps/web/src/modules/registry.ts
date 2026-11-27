import {
  CalendarDays,
  HandCoins,
  History,
  LayoutDashboard,
  ScrollText,
  Leaf,
  Package,
  Settings,
  ShoppingCart,
  Ticket,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";

/**
 * Registro único dos módulos. Menu, rotas "em breve" e ordem vêm daqui.
 * Para ligar um módulo novo: crie `src/app/(app)/<slug>/page.tsx` e mude `pronto` para true.
 */
export interface Modulo {
  slug: string;
  label: string;
  icon: LucideIcon;
  fase: number;
  pronto: boolean;
  resumo: string;
}

export const MODULOS: Modulo[] = [
  { slug: "", label: "Painel", icon: LayoutDashboard, fase: 5, pronto: true, resumo: "Visão geral, atrasos e alertas" },
  { slug: "produtos", label: "Produtos", icon: Package, fase: 1, pronto: true, resumo: "Catálogo, lotes e níveis de estoque" },
  { slug: "menu", label: "Menu", icon: ScrollText, fase: 1, pronto: true, resumo: "Preços por faixa: 3 g+, 10 g+, 30 g+" },
  { slug: "pessoas", label: "Pessoas", icon: Users, fase: 2, pronto: true, resumo: "Clientes e fornecedores, rankings" },
  { slug: "vendas", label: "Vendas", icon: ShoppingCart, fase: 3, pronto: true, resumo: "Saídas, descontos e lucro" },
  { slug: "cupons", label: "Cupons", icon: Ticket, fase: 3, pronto: true, resumo: "Cupons de desconto da semana" },
  { slug: "contas", label: "Contas", icon: HandCoins, fase: 4, pronto: false, resumo: "A pagar e a receber, fiado, parcelas" },
  { slug: "calendario", label: "Calendário", icon: CalendarDays, fase: 6, pronto: false, resumo: "Vencimentos e lembretes" },
  { slug: "financas", label: "Finanças", icon: Wallet, fase: 9, pronto: false, resumo: "Entradas, saídas e saldo" },
  { slug: "cultivo", label: "Cultivo", icon: Leaf, fase: 10, pronto: false, resumo: "Diário de cultivo" },
  { slug: "exclusoes", label: "Exclusões", icon: History, fase: 1, pronto: true, resumo: "Histórico de exclusões e restauração" },
  { slug: "configuracoes", label: "Ajustes", icon: Settings, fase: 7, pronto: false, resumo: "Notificações e preferências" },
];

export const href = (m: Modulo) => `/${m.slug}`;
