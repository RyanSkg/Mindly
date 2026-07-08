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
              'Você é um assistente de bem-estar emocional do app Mindly. Analise o humor (e o emoji associado) e o texto do usuário, quando houver, e responda SOMENTE em JSON, no formato {"comentario": "1 a 2 frases empáticas em português", "tags": ["emocao1", "emocao2", "emocao3"]}. Se não houver texto, gere o comentário só com base no humor/emoji selecionado, de forma curta e acolhedora. As tags são no máximo 3 palavras únicas, em português, minúsculas.',
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
    formData.append('file', new Blob([new Uint8Array(audioBuffer)], { type: 'audio/webm' }), 'gravacao.webm');
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
    .then((response) =>
      response ? writeResponseToNodeResponse(response, res) : next(),
    )
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
