"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MODULOS, href } from "@/modules/registry";
import { cn } from "@/lib/cn";
import { LogOut } from "lucide-react";
import { sair } from "@/app/login/actions";

function ativo(pathname: string, h: string) {
  return h === "/" ? pathname === "/" : pathname.startsWith(h);
}

/** Barra lateral (desktop). */
export function Sidebar() {
  return <SidebarView pathname={usePathname()} />;
}

export function SidebarView({ pathname }: { pathname: string }) {
  return (
    <aside className="hidden md:flex w-60 shrink-0 flex-col border-r border-line bg-panel px-3 py-5">
      <div className="px-3 pb-6 text-lg font-semibold tracking-tight">
        Controle<span className="text-accent">.</span>
      </div>
      <nav className="flex flex-col gap-0.5">
        {MODULOS.map((m) => {
          const h = href(m);
          const Icon = m.icon;
          return (
            <Link
              key={m.slug}
              href={h}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted transition-colors hover:bg-hover hover:text-fg",
                ativo(pathname, h) && "bg-hover text-fg font-medium",
              )}
            >
              <Icon size={18} strokeWidth={1.75} />
              <span className="flex-1">{m.label}</span>
              {!m.pronto && <span className="text-[10px] uppercase tracking-wide text-faint">breve</span>}
            </Link>
          );
        })}
      </nav>
      <form action={sair} className="mt-auto">
        <button className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted hover:bg-hover hover:text-fg">
          <LogOut size={18} strokeWidth={1.75} />
          Sair
        </button>
      </form>
    </aside>
  );
}

/** Barra inferior (celular): os 5 mais usados. */
const NO_CELULAR = ["", "produtos", "menu", "pessoas", "vendas"];

export function BottomNav() {
  return <BottomNavView pathname={usePathname()} />;
}

export function BottomNavView({ pathname }: { pathname: string }) {
  const itens = NO_CELULAR.map((s) => MODULOS.find((m) => m.slug === s)!);
  return (
    <nav className="md:hidden fixed inset-x-0 bottom-0 z-20 grid grid-cols-5 border-t border-line bg-panel/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
      {itens.map((m) => {
        const h = href(m);
        const Icon = m.icon;
        return (
          <Link
            key={m.slug}
            href={h}
            className={cn(
              "flex flex-col items-center gap-1 py-2.5 text-[11px] text-muted",
              ativo(pathname, h) && "text-accent",
            )}
          >
            <Icon size={20} strokeWidth={1.75} />
            {m.label}
          </Link>
        );
      })}
    </nav>
  );
}
