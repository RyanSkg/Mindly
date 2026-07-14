import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://dmrevpsqqavzxcavsjvd.supabase.co';

const LABEL_HUMOR = {
  bem: 'Bem',
  ansioso: 'Ansioso',
  neutro: 'Neutro',
  triste: 'Triste',
  motivado: 'Motivado',
  receioso: 'Receioso',
  irritado: 'Irritado',
  inseguro: 'Inseguro',
  otimista: 'Otimista',
  pessimista: 'Pessimista',
  envergonhado: 'Envergonhado',
  cansado: 'Cansado',
  confuso: 'Confuso',
  frustrado: 'Frustrado',
};

const CORES_TAG = ['roxo', 'azul', 'verde', 'vermelho'];
const REGEX_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MESES = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
];

/**
 * Roda todo dia (Vercel Cron). Pra cada usuário que ativou "relatório semanal
 * automático" e escolheu o dia da semana de hoje, gera um relatório de verdade
 * (igual ao botão manual do Psicólogo) e envia pro(s) psicólogo(a)(s) conectado(s)
 * dele no Mindly, avisando por email também.
 */
export default async function handler(req, res) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && req.headers.authorization !== `Bearer ${cronSecret}`) {
    res.status(401).json({ error: 'Não autorizado.' });
    return;
  }

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    res.status(500).json({ error: 'SUPABASE_SERVICE_ROLE_KEY não configurada no servidor.' });
    return;
  }

  const admin = createClient(SUPABASE_URL, serviceKey);
  const resendKey = process.env.RESEND_API_KEY;
  const diaDaSemanaHoje = new Date().getUTCDay();

  const { data: preferencias, error: erroPreferencias } = await admin
    .from('preferencias')
    .select('user_id')
    .eq('relatorio_semanal', true)
    .eq('relatorio_semanal_dia', diaDaSemanaHoje);

  if (erroPreferencias) {
    res.status(500).json({ error: erroPreferencias.message });
    return;
  }

  const seteDiasAtras = new Date();
  seteDiasAtras.setUTCDate(seteDiasAtras.getUTCDate() - 7);

  let enviados = 0;

  for (const { user_id } of preferencias ?? []) {
    // Valida antes de interpolar no filtro .or() (montado como texto).
    if (!REGEX_UUID.test(user_id)) continue;

    const { data: conexoes } = await admin
      .from('conexoes')
      .select('solicitante_id, destinatario_id')
      .eq('tipo', 'psicologo')
      .eq('status', 'aceito')
      .or(`solicitante_id.eq.${user_id},destinatario_id.eq.${user_id}`);

    const psicologoIds = (conexoes ?? []).map((c) =>
      c.solicitante_id === user_id ? c.destinatario_id : c.solicitante_id,
    );
    if (psicologoIds.length === 0) continue;

    const { data: registros } = await admin
      .from('registros')
      .select('humor, criado_em')
      .eq('user_id', user_id)
      .gte('criado_em', seteDiasAtras.toISOString());

    const lista = registros ?? [];
    const diasUnicos = new Set(lista.map((r) => new Date(r.criado_em).toDateString())).size;
    const semanas = Math.max(1, Math.ceil(diasUnicos / 7));

    const contagem = new Map();
    lista.forEach((r) => contagem.set(r.humor, (contagem.get(r.humor) ?? 0) + 1));
    const tags = [...contagem.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 2)
      .map(([humor], i) => ({
        label: (LABEL_HUMOR[humor] ?? humor).toLowerCase(),
        cor: CORES_TAG[i % CORES_TAG.length],
      }));

    const hoje = new Date();
    const titulo = `Relatório — ${MESES[hoje.getUTCMonth()]} ${hoje.getUTCFullYear()}`;
    const detalhes = `${lista.length} registros · ${semanas} semana${semanas > 1 ? 's' : ''} (envio automático)`;

    for (const psicologoId of psicologoIds) {
      const { error: erroInsercao } = await admin.from('relatorios').insert({
        user_id,
        psicologo_id: psicologoId,
        titulo,
        detalhes,
        tags,
        conversa_anexada: [],
      });
      if (erroInsercao) continue;

      enviados++;

      if (!resendKey) continue;

      const { data: paciente } = await admin.auth.admin.getUserById(user_id);
      const { data: psicologo } = await admin.auth.admin.getUserById(psicologoId);
      const emailPsicologo = psicologo?.user?.email;
      if (!emailPsicologo) continue;

      const nomePaciente =
        paciente?.user?.user_metadata?.display_name ||
        paciente?.user?.email?.split('@')[0] ||
        'paciente';
      const urlApp = process.env.APP_URL || 'https://mindly.vercel.app';

      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: 'Mindly <onboarding@resend.dev>',
          to: emailPsicologo,
          subject: `Novo relatório automático de ${nomePaciente}`,
          html: `<p>Você recebeu um novo relatório semanal de ${nomePaciente} no Mindly.</p><p><a href="${urlApp}/painel-psicologo">Ver no painel de pacientes</a></p>`,
        }),
      });
    }
  }

  res.status(200).json({ ok: true, enviados });
}
