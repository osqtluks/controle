import type { Metadata } from "next";
import { FormLogin } from "./form";

export const metadata: Metadata = { title: "Entrar" };

export default function Login() {
  return (
    <main className="flex flex-1 items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-2xl border border-line bg-card p-6">
        <div className="mb-6 text-2xl font-semibold tracking-tight">
          Controle<span className="text-accent">.</span>
        </div>
        <FormLogin />
      </div>
    </main>
  );
}
