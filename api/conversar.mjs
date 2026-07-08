export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Método não permitido' });
    return;
  }

  const { mensagens } = req.body ?? {};
  const apiKey = process.env.GROQ_API_KEY;

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
          ...mensagens.map((m) => ({ role: m.role, content: m.content })),
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
    res.status(200).json({ resposta: conteudo });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Erro ao conversar' });
  }
}
