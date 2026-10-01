export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'GEMINI_API_KEY missing in Vercel env' });
  }

  const { message, history } = req.body || {};
  if (!message) {
    return res.status(400).json({ error: 'message is required' });
  }

  const modelsToTry = [
    "gemini-3.8-flash",
    "gemini-flash-latest",
    "gemini-3.5-flash-lite"
  ];

  let lastError = null;

  for (const modelName of modelsToTry) {
    try {
      const endpoint = `https://generativelanguage.googleapis.com/v1/models/${modelName}:generateContent?key=${apiKey}`;

      const contents = [];
      if (Array.isArray(history)) {
        for (const h of history) {
          contents.push({
            role: h.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: h.content || h.text || '' }]
          });
        }
      }
      contents.push({ role: 'user', parts: [{ text: message }] });

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error?.message || `API error with ${modelName}`);
      }

      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) {
        throw new Error(`Empty response from ${modelName}`);
      }

      return res.status(200).json({ reply: text, modelUsed: modelName });

    } catch (err) {
      lastError = err;
      console.log(`[Iqbal AI] ${modelName} failed, trying next... `, err.message);
      continue;
    }
  }

  return res.status(500).json({
    error: 'All models failed',
    details: lastError?.message || 'Unknown error'
  });
}
