import { supabase } from '../integrations/supabase/client';

/**
 * Retorna o usuário logado, renovando o token primeiro se ele estiver
 * prestes a expirar (ou já expirado). Evita que ações falhem em
 * silêncio quando a aba fica muito tempo aberta em segundo plano.
 */
export async function obterUsuarioValido() {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return null;

  const expiraEm = (session.expires_at ?? 0) * 1000;
  const prestesAExpirar = expiraEm - Date.now() < 60_000;

  if (prestesAExpirar) {
    const { data, error } = await supabase.auth.refreshSession();
    if (error || !data.session) return null;
    return data.session.user;
  }

  return session.user;
}

/**
 * Header Authorization com o token da sessão atual (renovado se preciso),
 * exigido pelos endpoints /api/* que usam a IA.
 */
export async function cabecalhoAutenticacao(): Promise<Record<string, string>> {
  await obterUsuarioValido();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session ? { Authorization: `Bearer ${session.access_token}` } : {};
}
