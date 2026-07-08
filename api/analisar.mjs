export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Método não permitido' });
    return;
  }

  const { humor, texto } = req.body ?? {};
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    res.status(500).json({ error: 'OPENAI_API_KEY não configurada no servidor.' });
    return;
  }

  try {
    const resposta = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content:
              'Você é um assistente de bem-estar emocional do app EchoMind. Analise o humor e o texto do usuário e responda SOMENTE em JSON, no formato {"comentario": "1 a 2 frases empáticas em português", "tags": ["emocao1", "emocao2", "emocao3"]}. As tags são no máximo 3 palavras únicas, em português, minúsculas.',
          },
          {
            role: 'user',
            content: `Humor selecionado: ${humor}\nTexto do registro: ${texto || '(sem texto)'}`,
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
    res.status(200).json(JSON.parse(conteudo));
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Erro ao analisar' });
  }
}
