import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { SUPABASE_KEY, SUPABASE_URL } from "./env";

/** Cliente Supabase para Server Components, Server Actions e Route Handlers. */
export async function createClient() {
  // Dados do usuário são sempre por requisição: marca a renderização como dinâmica
  // antes que o supabase-js use Date.now() (o Next recusa isso no pré-render).
  await connection();
  const store = await cookies();
  return createServerClient(SUPABASE_URL, SUPABASE_KEY, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (lista) => {
        try {
          lista.forEach(({ name, value, options }) => store.set(name, value, options));
        } catch {
          // Chamado de um Server Component (não pode gravar cookie). O proxy renova a sessão.
        }
      },
    },
  });
}
