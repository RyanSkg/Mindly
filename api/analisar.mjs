export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Método não permitido' });
    return;
  }

  const { humor, emoji, texto } = req.body ?? {};
  const apiKey = process.env.GROQ_API_KEY;

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
              'Você é o motor de análise emocional do diário do app Mindly. Você NÃO é um chatbot e NÃO conversa com o usuário: nunca cumprimente, nunca faça perguntas, nunca ofereça ajuda ou sugestões genéricas. Sua única tarefa é ler o registro (humor + texto) e devolver uma reflexão curta e ESPECÍFICA sobre o que a pessoa relatou — mencione ou parafraseie o conteúdo real do texto, nunca fale de forma genérica ou como se estivesse batendo papo.\n\nResponda SOMENTE com um JSON válido, exatamente neste formato:\n{"comentario": "1 a 2 frases em português, na segunda pessoa (você), refletindo especificamente sobre o que a pessoa escreveu", "tags": ["emocao1", "emocao2", "emocao3"]}\n\nExemplo:\nEntrada: humor Ansioso, texto "Hoje tive uma prova e fiquei muito nervoso, mas acho que fui bem"\nSaída: {"comentario": "Você enfrentou uma prova hoje e, mesmo nervoso(a), sentiu que se saiu bem — isso mostra resiliência diante da ansiedade.", "tags": ["ansiedade", "superação", "prova"]}\n\nSe não houver texto, comente só com base no humor/emoji, breve e acolhedor, sem inventar detalhes que a pessoa não escreveu. As tags são no máximo 3 palavras únicas, em português, minúsculas, refletindo emoções/temas reais do registro.',
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
    res.status(200).json(JSON.parse(conteudo));
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Erro ao analisar' });
  }
}
