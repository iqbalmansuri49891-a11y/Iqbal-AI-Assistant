export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { message } = req.body || {};

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return res.status(500).json({ error: 'GEMINI_API_KEY is not configured on Vercel' });
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1/models/gemini-pro:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [{ text: message }]
            }
          ]
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        error: data?.error?.message || 'Gemini API error'
      });
    }

    // Safe extraction handling for Gemini response structure
    const candidate = data?.candidates?.[0];
    const reply = candidate?.content?.parts?.[0]?.text || candidate?.output;

    if (!reply) {
      return res.status(500).json({ error: 'No response text received from Gemini' });
    }

    return res.status(200).json({ reply });

  } catch (error) {
    return res.status(500).json({ error: error.message || 'Server error' });
  }
}
