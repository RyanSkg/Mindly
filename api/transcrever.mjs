const GEMINI_MODELO = 'gemini-2.0-flash';

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Método não permitido' });
    return;
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: 'GEMINI_API_KEY não configurada no servidor.' });
    return;
  }

  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }
  const audioBuffer = Buffer.concat(chunks);

  if (audioBuffer.length === 0) {
    res.status(400).json({ error: 'Áudio vazio.' });
    return;
  }

  try {
    const resposta = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODELO}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: 'Transcreva o áudio a seguir para texto em português do Brasil. Responda apenas com a transcrição pura, sem comentários, sem aspas.' },
              { inlineData: { mimeType: 'audio/webm', data: audioBuffer.toString('base64') } },
            ],
          }],
        }),
      },
    );

    if (!resposta.ok) {
      const erro = await resposta.text();
      res.status(resposta.status).json({ error: erro });
      return;
    }

    const dados = await resposta.json();
    const texto = dados.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
    res.status(200).json({ texto: texto.trim() });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Erro ao transcrever' });
  }
}
