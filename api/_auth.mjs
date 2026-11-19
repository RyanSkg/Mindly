import { createClient } from '@supabase/supabase-js';

// URL e chave "anon" são públicas por design (já vão para o navegador).
// Elas só servem para validar o token de sessão enviado pelo usuário.
const SUPABASE_URL = 'https://dmrevpsqqavzxcavsjvd.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRtcmV2cHNxcWF2enhjYXZzanZkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM0Njg0NjcsImV4cCI6MjA5OTA0NDQ2N30.umbOAnZBNEaHeQpMIQZxq3c1g-p_r634f_Nr1E1mW24';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

/**
 * Garante que a requisição vem de um usuário logado (token do Supabase no
 * header Authorization). Evita que qualquer pessoa na internet use a cota
 * da IA chamando os endpoints diretamente. Retorna o usuário, ou null depois
 * de já ter respondido 401.
 */
export async function exigirUsuario(req, res) {
  const authHeader = req.headers.authorization ?? '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!token) {
    res.status(401).json({ error: 'Não autenticado.' });
    return null;
  }
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) {
    res.status(401).json({ error: 'Sessão inválida.' });
    return null;
  }
  return data.user;
}

/**
 * Protege os endpoints de cron. Em produção (Vercel) o CRON_SECRET é
 * obrigatório; sem ele o endpoint fica bloqueado em vez de aberto.
 */
export function cronAutorizado(req, res) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    if (process.env.VERCEL_ENV === 'production') {
      res.status(500).json({ error: 'CRON_SECRET não configurado no servidor.' });
      return false;
    }
    return true;
  }
  if (req.headers.authorization !== `Bearer ${cronSecret}`) {
    res.status(401).json({ error: 'Não autorizado.' });
    return false;
  }
  return true;
}
