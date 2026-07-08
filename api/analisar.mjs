const GEMINI_MODELO = 'gemini-2.0-flash';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Método não permitido' });
    return;
  }

  const { humor, emoji, texto } = req.body ?? {};
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    res.status(500).json({ error: 'GEMINI_API_KEY não configurada no servidor.' });
    return;
  }

  const descricaoTexto = texto
    ? texto
    : '(o usuário não escreveu nada, apenas selecionou o humor/emoji — baseie a análise só nisso)';

  try {
    const resposta = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODELO}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{
              text: 'Você é um assistente de bem-estar emocional do app EchoMind. Analise o humor (e o emoji associado) e o texto do usuário, quando houver, e responda SOMENTE em JSON, no formato {"comentario": "1 a 2 frases empáticas em português", "tags": ["emocao1", "emocao2", "emocao3"]}. Se não houver texto, gere o comentário só com base no humor/emoji selecionado, de forma curta e acolhedora. As tags são no máximo 3 palavras únicas, em português, minúsculas.',
            }],
          },
          contents: [{
            parts: [{ text: `Humor selecionado: ${humor} (emoji: ${emoji ?? '—'})\nTexto do registro: ${descricaoTexto}` }],
          }],
          generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0.6,
          },
        }),
      },
    );

    if (!resposta.ok) {
      const erro = await resposta.text();
      res.status(resposta.status).json({ error: erro });
      return;
    }

    const dados = await resposta.json();
    const conteudo = dados.candidates?.[0]?.content?.parts?.[0]?.text ?? '{}';
    res.status(200).json(JSON.parse(conteudo));
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Erro ao analisar' });
  }
}
