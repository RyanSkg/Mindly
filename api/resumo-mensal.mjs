/**
 * Gera um resumo do mês do usuário com IA (Groq), a partir dos humores
 * agregados que o navegador envia (sem textos do diário — só humor + data).
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Método não permitido' });
    return;
  }

  const { registros, mes } = req.body ?? {};
  const apiKey = process.env.GROQ_API_KEY;

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
    .map(r => `${r.dia}: ${r.humor}`)
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
    res.status(200).json(JSON.parse(conteudo));
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Erro ao resumir' });
  }
}
