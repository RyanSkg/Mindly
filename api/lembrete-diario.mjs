import { cronAutorizado } from './_auth.mjs';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://dmrevpsqqavzxcavsjvd.supabase.co';

export default async function handler(req, res) {
  if (!cronAutorizado(req, res)) return;

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const resendKey = process.env.RESEND_API_KEY;
  if (!serviceKey || !resendKey) {
    res
      .status(500)
      .json({ error: 'SUPABASE_SERVICE_ROLE_KEY ou RESEND_API_KEY não configurada no servidor.' });
    return;
  }

  const admin = createClient(SUPABASE_URL, serviceKey);

  const { data: preferencias, error: erroPreferencias } = await admin
    .from('preferencias')
    .select('user_id')
    .eq('lembrete_diario', true);

  if (erroPreferencias) {
    res.status(500).json({ error: erroPreferencias.message });
    return;
  }

  const inicioDoDia = new Date();
  inicioDoDia.setUTCHours(0, 0, 0, 0);

  let enviados = 0;

  for (const { user_id } of preferencias ?? []) {
    const { count } = await admin
      .from('registros')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user_id)
      .gte('criado_em', inicioDoDia.toISOString());

    if (count && count > 0) continue;

    const { data: usuario } = await admin.auth.admin.getUserById(user_id);
    const email = usuario?.user?.email;
    if (!email) continue;

    const nome = usuario.user.user_metadata?.display_name || email.split('@')[0];
    const urlApp = process.env.APP_URL || 'https://mindly.vercel.app';

    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Mindly <onboarding@resend.dev>',
        to: email,
        subject: 'Como você está se sentindo hoje?',
        html: `<p>Oi, ${nome}!</p><p>Você ainda não registrou seu humor hoje no Mindly. Que tal reservar um minuto para isso?</p><p><a href="${urlApp}/diario">Abrir o Diário</a></p>`,
      }),
    });

    enviados++;
  }

  res.status(200).json({ ok: true, enviados });
}
