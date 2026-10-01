export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { message } = req.body || {};

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    const apiKey = process.env.OPENROUTER_API_KEY;

    if (!apiKey) {
      return res.status(500).json({ error: 'OPENROUTER_API_KEY is not configured on Vercel' });
    }

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': 'https://ver.cel',
        'X-Title': 'Iqbal AI Assistant'
      },
      body: JSON.stringify({
      model: 'openrouter/free',
        messages: [
          { role: 'user', content: message }
        ],
        stream: false
      })
    });

    const responseText = await response.text();
    let data;
    try {
      data = JSON.parse(responseText);
    } catch (e) {
      return res.status(500).json({ error: 'Invalid JSON response from OpenRouter: ' + responseText.slice(0, 100) });
    }

    if (!response.ok) {
      return res.status(response.status).json({
        error: data?.error?.message || 'OpenRouter API error'
      });
    }

    const reply = data?.choices?.[0]?.message?.content;

    if (!reply) {
      return res.status(500).json({ error: 'No response from OpenRouter' });
    }

    return res.status(200).json({ reply });

  } catch (error) {
    return res.status(500).json({ error: error.message || 'Server error' });
  }
}
