export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { message } = req.body || {};
    if (!message) return res.status(400).json({ error: 'Message is required' });

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return res.status(500).json({ error: 'GEMINI_API_KEY not set in Vercel' });

    // Sahi models jo Google par 2026 me chal rahe hai
    const modelsToTry = [
      "gemini-2.5-flash",
      "gemini-2.0-flash",
      "gemini-1.5-flash"
    ];

    let lastError = "";
    for (const modelName of modelsToTry) {
      try {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: message }] }]
            })
          }
        );
        const data = await response.json();
        if (!response.ok) {
          lastError = `${modelName}: ${data?.error?.message || response.statusText}`;
          continue; // next model try karo
        }
        const reply = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (reply) {
          return res.status(200).json({ reply, modelUsed: modelName });
        } else {
          lastError = `${modelName}: No reply`;
        }
      } catch (e) {
        lastError = `${modelName}: ${(e as Error).message}`;
      }
    }
    // Agar sab fail ho gaye
    return res.status(500).json({ error: `All models failed. Last error: ${lastError}. Please check GEMINI_API_KEY` });

  } catch (error) {
    return res.status(500).json({ error: (error as Error).message });
  }
}
