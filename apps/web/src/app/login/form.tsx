"use client";

import { useActionState } from "react";
import { entrar, type EstadoLogin } from "./actions";

const campo =
  "w-full rounded-lg border border-line bg-bg px-3 py-2.5 text-sm outline-none focus:border-accent";

export function FormLogin() {
  const [estado, acao, enviando] = useActionState<EstadoLogin, FormData>(entrar, {});
  return (
    <form action={acao} className="space-y-3">
      <label className="block space-y-1">
        <span className="text-xs text-muted">E-mail</span>
        <input name="email" type="email" autoComplete="email" required className={campo} />
      </label>
      <label className="block space-y-1">
        <span className="text-xs text-muted">Senha</span>
        <input name="senha" type="password" autoComplete="current-password" required className={campo} />
      </label>
      {estado.erro && <p className="text-sm text-red-400">{estado.erro}</p>}
      <button
        disabled={enviando}
        className="w-full rounded-lg bg-accent py-2.5 text-sm font-semibold text-black transition-opacity disabled:opacity-60"
      >
        {enviando ? "Entrando…" : "Entrar"}
      </button>
    </form>
  );
}
