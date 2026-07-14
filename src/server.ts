import 'dotenv/config';
import {
  AngularNodeAppEngine,
  createNodeRequestHandler,
  isMainModule,
  writeResponseToNodeResponse,
} from '@angular/ssr/node';
import express from 'express';
import { join } from 'node:path';
import { createClient } from '@supabase/supabase-js';

const browserDistFolder = join(import.meta.dirname, '../browser');
const SUPABASE_URL = 'https://dmrevpsqqavzxcavsjvd.supabase.co';

const app = express();
const angularApp = new AngularNodeAppEngine();

app.use(express.json());

/**
 * Analisa o humor/emoji/texto do Diário com IA (Groq, gratuito, sem cartão)
 * e devolve um comentário empático + tags de emoções. A chave da API
 * nunca chega ao navegador — fica só aqui no servidor.
 */
app.post('/api/analisar', async (req, res) => {
  const { humor, emoji, texto } = req.body ?? {};
  const apiKey = process.env['GROQ_API_KEY'];

  if (!apiKey) {
    res.status(500).json({ error: 'GROQ_API_KEY não configurada no servidor.' });
    return;
  }

  const descricaoTexto = texto
    ? texto
    : '(o usuário não escreveu nada, apenas selecionou o humor/emoji — baseie a análise só nisso)';

  try {
    const resposta = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          {
            role: 'system',
            content:
              'Você é o motor de análise emocional do diário do app Mindly. Você NÃO é um chatbot e NÃO conversa com o usuário: nunca cumprimente, nunca faça perguntas. Sua tarefa é ler o registro (humor + texto) e devolver: (1) uma reflexão curta e ESPECÍFICA sobre o que a pessoa relatou — mencione ou parafraseie o conteúdo real do texto, sem ficar apenas repetindo o óbvio que ela já sabe; (2) uma sugestão prática, concreta e ACIONÁVEL que a pessoa possa fazer agora ou hoje, relacionada especificamente à situação e ao humor dela (nunca um conselho genérico tipo "respire fundo" sem contexto — a sugestão deve conectar com o que ela escreveu); e (3) até 3 sugestões de conteúdo (ler, assistir ou ouvir) relacionadas ao tema/emoção do registro. IMPORTANTE: nunca invente títulos específicos de livros, podcasts, vídeos, autores ou canais que você não tenha certeza absoluta que existem — em vez disso, descreva o TEMA ou TIPO de conteúdo que a pessoa pode procurar (ex: "um podcast sobre gestão de ansiedade no trabalho", "vídeos curtos de respiração guiada no YouTube", "artigos sobre a técnica pomodoro para procrastinação").\n\nResponda SOMENTE com um JSON válido, exatamente neste formato:\n{"comentario": "1 a 2 frases em português, na segunda pessoa (você), refletindo especificamente sobre o que a pessoa escreveu", "sugestao": "1 frase em português, na segunda pessoa (você), com uma ação prática e específica ligada à situação relatada", "conteudos": [{"tipo": "ler" | "assistir" | "ouvir", "sugestao": "descrição do tema/tipo de conteúdo, sem título inventado"}], "tags": ["emocao1", "emocao2", "emocao3"]}\n\nExemplo:\nEntrada: humor Frustrado, texto "Meus planos não estão saindo como eu queria, sinto que perdi o controle"\nSaída: {"comentario": "Você está frustrado(a) porque seus planos não saíram como esperado, e isso trouxe uma sensação de perda de controle.", "sugestao": "Que tal listar as 2 ou 3 coisas que você ainda consegue controlar nessa situação e focar sua energia nelas hoje?", "conteudos": [{"tipo": "ouvir", "sugestao": "um podcast sobre como lidar com a sensação de perda de controle"}, {"tipo": "ler", "sugestao": "artigos sobre a diferença entre o que podemos e não podemos controlar (Círculo de Controle)"}], "tags": ["frustração", "descontrole", "planejamento"]}\n\nSe não houver texto, baseie os campos só no humor/emoji, breve e acolhedor, sem inventar detalhes que a pessoa não escreveu. As tags são no máximo 3 palavras únicas, em português, minúsculas, refletindo emoções/temas reais do registro.',
          },
          {
            role: 'user',
            content: `Humor selecionado: ${humor} (emoji: ${emoji ?? '—'})\nTexto do registro: ${descricaoTexto}`,
          },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.6,
      }),
    });

    if (!resposta.ok) {
      const erro = await resposta.text();
      res.status(resposta.status).json({ error: erro });
      return;
    }

    const dados = await resposta.json();
    const conteudo = dados.choices?.[0]?.message?.content ?? '{}';
    res.json(JSON.parse(conteudo));
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Erro ao analisar' });
  }
});

/**
 * Continua a conversa entre o usuário e a IA sobre um registro do
 * Diário (botão "Responder" na análise). Diferente de /api/analisar,
 * aqui a IA conversa de verdade — faz perguntas, dá suporte.
 */
app.post('/api/conversar', async (req, res) => {
  const { mensagens } = req.body ?? {};
  const apiKey = process.env['GROQ_API_KEY'];

  if (!apiKey) {
    res.status(500).json({ error: 'GROQ_API_KEY não configurada no servidor.' });
    return;
  }
  if (!Array.isArray(mensagens) || mensagens.length === 0) {
    res.status(400).json({ error: 'Mensagens inválidas.' });
    return;
  }

  try {
    const resposta = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          {
            role: 'system',
            content:
              'Você é o assistente de apoio emocional do app Mindly, conversando com o usuário sobre o registro que ele acabou de fazer no diário. Seja acolhedor, empático e direto. Faça perguntas de acompanhamento quando fizer sentido e ofereça sugestões práticas quando apropriado. Respostas curtas: no máximo 3 frases. Fale em português, na segunda pessoa (você). Nunca se apresente nem cumprimente — a conversa já está em andamento.',
          },
          ...mensagens.map((m: { role: string; content: string }) => ({
            role: m.role,
            content: m.content,
          })),
        ],
        temperature: 0.7,
      }),
    });

    if (!resposta.ok) {
      const erro = await resposta.text();
      res.status(resposta.status).json({ error: erro });
      return;
    }

    const dados = await resposta.json();
    const conteudo = dados.choices?.[0]?.message?.content ?? '';
    res.json({ resposta: conteudo });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Erro ao conversar' });
  }
});

/**
 * Transcreve um áudio gravado no navegador (Diário → botão "Áudio")
 * usando o Whisper do Groq (gratuito), e devolve o texto reconhecido.
 */
app.post('/api/transcrever', express.raw({ type: '*/*', limit: '15mb' }), async (req, res) => {
  const apiKey = process.env['GROQ_API_KEY'];

  if (!apiKey) {
    res.status(500).json({ error: 'GROQ_API_KEY não configurada no servidor.' });
    return;
  }

  const audioBuffer = req.body as Buffer;
  if (!audioBuffer || !Buffer.isBuffer(audioBuffer) || audioBuffer.length === 0) {
    res.status(400).json({ error: 'Áudio vazio.' });
    return;
  }

  try {
    const formData = new FormData();
    formData.append(
      'file',
      new Blob([new Uint8Array(audioBuffer)], { type: 'audio/webm' }),
      'gravacao.webm',
    );
    formData.append('model', 'whisper-large-v3-turbo');
    formData.append('language', 'pt');

    const resposta = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: formData,
    });

    if (!resposta.ok) {
      const erro = await resposta.text();
      res.status(resposta.status).json({ error: erro });
      return;
    }

    const dados = await resposta.json();
    res.json({ texto: dados.text ?? '' });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Erro ao transcrever' });
  }
});

/**
 * Apaga a conta do usuário autenticado (dados + login) de vez.
 * Usa a service role key — precisa ficar só no servidor, nunca no navegador.
 */
app.post('/api/excluir-conta', async (req, res) => {
  const authHeader = req.headers.authorization ?? '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  const serviceKey = process.env['SUPABASE_SERVICE_ROLE_KEY'];

  if (!token) {
    res.status(401).json({ error: 'Não autenticado.' });
    return;
  }
  if (!serviceKey) {
    res.status(500).json({ error: 'SUPABASE_SERVICE_ROLE_KEY não configurada no servidor.' });
    return;
  }

  const admin = createClient(SUPABASE_URL, serviceKey);

  const { data: userData, error: userError } = await admin.auth.getUser(token);
  if (userError || !userData.user) {
    res.status(401).json({ error: 'Sessão inválida.' });
    return;
  }

  const { error: deleteError } = await admin.auth.admin.deleteUser(userData.user.id);
  if (deleteError) {
    res.status(500).json({ error: deleteError.message });
    return;
  }

  res.json({ ok: true });
});

const LABEL_HUMOR: Record<string, string> = {
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

/**
 * Envia um lembrete por email para quem ainda não registrou o humor hoje
 * e tem "lembrete diário" ativado nas Preferências. Disparado por um
 * Vercel Cron em produção; pode ser chamado manualmente em dev para testar.
 */
app.get('/api/lembrete-diario', async (req, res) => {
  const cronSecret = process.env['CRON_SECRET'];
  if (cronSecret && req.headers.authorization !== `Bearer ${cronSecret}`) {
    res.status(401).json({ error: 'Não autorizado.' });
    return;
  }

  const serviceKey = process.env['SUPABASE_SERVICE_ROLE_KEY'];
  const resendKey = process.env['RESEND_API_KEY'];
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
    if (!usuario?.user || !email) continue;

    const nome = usuario.user.user_metadata?.['display_name'] || email.split('@')[0];
    const urlApp = process.env['APP_URL'] || 'https://mindly.vercel.app';

    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'Mindly <onboarding@resend.dev>',
        to: email,
        subject: 'Como você está se sentindo hoje?',
        html: `<p>Oi, ${nome}!</p><p>Você ainda não registrou seu humor hoje no Mindly. Que tal reservar um minuto para isso?</p><p><a href="${urlApp}/diario">Abrir o Diário</a></p>`,
      }),
    });

    enviados++;
  }

  res.json({ ok: true, enviados });
});

/**
 * Gera um resumo do mês do usuário com IA (Groq), a partir dos humores
 * agregados que o navegador envia (sem textos do diário — só humor + data).
 */
app.post('/api/resumo-mensal', async (req, res) => {
  const { registros, mes } = req.body ?? {};
  const apiKey = process.env['GROQ_API_KEY'];

  if (!apiKey) {
    res.status(500).json({ error: 'GROQ_API_KEY não configurada no servidor.' });
    return;
  }
  if (!Array.isArray(registros) || registros.length === 0) {
    res.status(400).json({ error: 'Sem registros para resumir.' });
    return;
  }

  const lista = registros
    .slice(0, 120)
    .map((r: { dia: string; humor: string }) => `${r.dia}: ${r.humor}`)
    .join('\n');

  try {
    const resposta = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          {
            role: 'system',
            content:
              'Você é o motor de análise do app Mindly. Recebe a lista de humores registrados por uma pessoa ao longo de um mês (data: humor) e devolve um resumo do mês em português, na segunda pessoa (você). O resumo deve: (1) apontar o padrão geral do mês; (2) destacar padrões por dia da semana ou períodos se existirem de verdade nos dados (ex: "as segundas foram mais difíceis"); (3) terminar com uma observação encorajadora curta. NUNCA invente detalhes que não estão nos dados. 3 a 5 frases no total, texto corrido, sem listas, sem cumprimentos. Responda SOMENTE com um JSON válido: {"resumo": "..."}',
          },
          {
            role: 'user',
            content: `Mês: ${mes ?? '—'}\nRegistros (data: humor):\n${lista}`,
          },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.5,
      }),
    });

    if (!resposta.ok) {
      const erro = await resposta.text();
      res.status(resposta.status).json({ error: erro });
      return;
    }

    const dados = await resposta.json();
    const conteudo = dados.choices?.[0]?.message?.content ?? '{}';
    res.json(JSON.parse(conteudo));
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Erro ao resumir' });
  }
});

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
app.get('/api/relatorio-semanal', async (req, res) => {
  const cronSecret = process.env['CRON_SECRET'];
  if (cronSecret && req.headers.authorization !== `Bearer ${cronSecret}`) {
    res.status(401).json({ error: 'Não autorizado.' });
    return;
  }

  const serviceKey = process.env['SUPABASE_SERVICE_ROLE_KEY'];
  if (!serviceKey) {
    res.status(500).json({ error: 'SUPABASE_SERVICE_ROLE_KEY não configurada no servidor.' });
    return;
  }

  const admin = createClient(SUPABASE_URL, serviceKey);
  const resendKey = process.env['RESEND_API_KEY'];
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

    const contagem = new Map<string, number>();
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
        paciente?.user?.user_metadata?.['display_name'] ||
        paciente?.user?.email?.split('@')[0] ||
        'paciente';
      const urlApp = process.env['APP_URL'] || 'https://mindly.vercel.app';

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

  res.json({ ok: true, enviados });
});

/**
 * Serve static files from /browser
 */
app.use(
  express.static(browserDistFolder, {
    maxAge: '1y',
    index: false,
    redirect: false,
  }),
);

/**
 * Handle all other requests by rendering the Angular application.
 */
app.use((req, res, next) => {
  angularApp
    .handle(req)
    .then((response) => (response ? writeResponseToNodeResponse(response, res) : next()))
    .catch(next);
});

/**
 * Start the server if this module is the main entry point, or it is ran via PM2.
 * The server listens on the port defined by the `PORT` environment variable, or defaults to 4000.
 */
if (isMainModule(import.meta.url) || process.env['pm_id']) {
  const port = process.env['PORT'] || 4000;
  app.listen(port, (error) => {
    if (error) {
      throw error;
    }

    console.log(`Node Express server listening on http://localhost:${port}`);
  });
}

/**
 * Request handler used by the Angular CLI (for dev-server and during build) or Firebase Cloud Functions.
 */
export const reqHandler = createNodeRequestHandler(app);
