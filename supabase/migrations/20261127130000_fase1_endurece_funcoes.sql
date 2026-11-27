-- Endurecimento apontado pelo `supabase db advisors`.

-- search_path fixo em todas as funções.
alter function public.fn_tocar_updated_at() set search_path = public;
alter function public.fn_somente_acrescentar() set search_path = public;

-- Funções de trigger não são API: ninguém chama por /rpc.
revoke execute on function
  public.fn_registrar_historico(),
  public.fn_lote_gera_entrada(),
  public.fn_tocar_updated_at(),
  public.fn_somente_acrescentar()
from public, anon, authenticated;

-- Daqui pra frente, função nova nasce sem EXECUTE público; libere explicitamente se for RPC.
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;
