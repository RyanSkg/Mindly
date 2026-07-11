import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://dmrevpsqqavzxcavsjvd.supabase.co';

const LABEL_HUMOR = {
  bem: 'Bem', ansioso: 'Ansioso', neutro: 'Neutro', triste: 'Triste', motivado: 'Motivado',
  receioso: 'Receioso', irritado: 'Irritado', inseguro: 'Inseguro', otimista: 'Otimista',
  pessimista: 'Pessimista', envergonhado: 'Envergonhado', cansado: 'Cansado', confuso: 'Confuso', frustrado: 'Frustrado',
};

export default async function handler(req, res) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && req.headers.authorization !== `Bearer ${cronSecret}`) {
    res.status(401).json({ error: 'Não autorizado.' });
    return;
  }

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const resendKey = process.env.RESEND_API_KEY;
  if (!serviceKey || !resendKey) {
    res.status(500).json({ error: 'SUPABASE_SERVICE_ROLE_KEY ou RESEND_API_KEY não configurada no servidor.' });
    return;
  }

  const admin = createClient(SUPABASE_URL, serviceKey);

  const { data: preferencias, error: erroPreferencias } = await admin
    .from('preferencias')
    .select('user_id')
    .eq('relatorio_semanal', true);

  if (erroPreferencias) {
    res.status(500).json({ error: erroPreferencias.message });
    return;
  }

  const seteDiasAtras = new Date();
  seteDiasAtras.setUTCDate(seteDiasAtras.getUTCDate() - 7);

  let enviados = 0;

  for (const { user_id } of preferencias ?? []) {
    const { data: registros } = await admin
      .from('registros')
      .select('humor, criado_em')
      .eq('user_id', user_id)
      .gte('criado_em', seteDiasAtras.toISOString());

    if (!registros || registros.length === 0) continue;

    const { data: usuario } = await admin.auth.admin.getUserById(user_id);
    const email = usuario?.user?.email;
    if (!email) continue;

    const nome = usuario.user.user_metadata?.display_name || email.split('@')[0];
    const urlApp = process.env.APP_URL || 'https://mindly.vercel.app';

    const diasUnicos = new Set(registros.map(r => new Date(r.criado_em).toDateString())).size;
    const contagem = new Map();
    registros.forEach(r => contagem.set(r.humor, (contagem.get(r.humor) ?? 0) + 1));
    const humorMaisFrequente = [...contagem.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
    const humorLabel = LABEL_HUMOR[humorMaisFrequente] ?? humorMaisFrequente ?? '—';

    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Mindly <onboarding@resend.dev>',
        to: email,
        subject: 'Seu resumo semanal no Mindly',
        html: `<p>Oi, ${nome}!</p>
          <p>Aqui está o resumo da sua semana:</p>
          <ul>
            <li><strong>${registros.length}</strong> registro${registros.length === 1 ? '' : 's'}</li>
            <li><strong>${diasUnicos}</strong> dia${diasUnicos === 1 ? '' : 's'} ativo${diasUnicos === 1 ? '' : 's'}</li>
            <li>Humor mais frequente: <strong>${humorLabel}</strong></li>
          </ul>
          <p><a href="${urlApp}/dashboard">Ver dashboard completo</a></p>`,
      }),
    });

    enviados++;
  }

  res.status(200).json({ ok: true, enviados });
}
