import { BottomNav, Sidebar } from "@/components/shell/nav";

// Área logada. Quem não tem sessão é barrado antes, no `src/proxy.ts`,
// e os dados em si são protegidos por RLS no banco.
export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <Sidebar />
      <main className="flex-1 min-w-0 px-4 pt-6 pb-24 md:px-8 md:pb-10">{children}</main>
      <BottomNav />
    </>
  );
}
