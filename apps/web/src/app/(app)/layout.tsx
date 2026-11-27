import { Suspense } from "react";
import { Toaster } from "sonner";
import { BottomNav, BottomNavView, Sidebar, SidebarView } from "@/components/shell/nav";

// Área logada. Quem não tem sessão é barrado antes, no `src/proxy.ts`,
// e os dados em si são protegidos por RLS no banco.
export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      {/* O menu lê a URL (item ativo); o fallback é o mesmo menu sem destaque. */}
      <Suspense fallback={<SidebarView pathname="" />}>
        <Sidebar />
      </Suspense>
      <main className="flex-1 min-w-0 px-4 pt-6 pb-24 md:px-8 md:pb-10">{children}</main>
      <Suspense fallback={<BottomNavView pathname="" />}>
        <BottomNav />
      </Suspense>
      {/* Avisos (ex.: "foi para a Lixeira · Desfazer"); no celular, acima da barra inferior. */}
      <Toaster theme="dark" position="bottom-center" richColors closeButton mobileOffset={{ bottom: 80 }} />
    </>
  );
}
