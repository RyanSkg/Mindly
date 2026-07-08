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
              'Você é o motor de análise emocional do diário do app Mindly. Você NÃO é um chatbot e NÃO conversa com o usuário: nunca cumprimente, nunca faça perguntas. Sua tarefa é ler o registro (humor + texto) e devolver: (1) uma reflexão curta e ESPECÍFICA sobre o que a pessoa relatou — mencione ou parafraseie o conteúdo real do texto, sem ficar apenas repetindo o óbvio que ela já sabe; e (2) uma sugestão prática, concreta e ACIONÁVEL que a pessoa possa fazer agora ou hoje, relacionada especificamente à situação e ao humor dela (nunca um conselho genérico tipo "respire fundo" sem contexto — a sugestão deve conectar com o que ela escreveu).\n\nResponda SOMENTE com um JSON válido, exatamente neste formato:\n{"comentario": "1 a 2 frases em português, na segunda pessoa (você), refletindo especificamente sobre o que a pessoa escreveu", "sugestao": "1 frase em português, na segunda pessoa (você), com uma ação prática e específica ligada à situação relatada", "tags": ["emocao1", "emocao2", "emocao3"]}\n\nExemplo:\nEntrada: humor Frustrado, texto "Meus planos não estão saindo como eu queria, sinto que perdi o controle"\nSaída: {"comentario": "Você está frustrado(a) porque seus planos não saíram como esperado, e isso trouxe uma sensação de perda de controle.", "sugestao": "Que tal listar as 2 ou 3 coisas que você ainda consegue controlar nessa situação e focar sua energia nelas hoje?", "tags": ["frustração", "descontrole", "planejamento"]}\n\nSe não houver texto, baseie os dois campos só no humor/emoji, breve e acolhedor, sem inventar detalhes que a pessoa não escreveu. As tags são no máximo 3 palavras únicas, em português, minúsculas, refletindo emoções/temas reais do registro.',
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
