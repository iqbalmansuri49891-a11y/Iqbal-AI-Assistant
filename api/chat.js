export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { message } = req.body || {};

    if (!message) {
      return res.status(400).json({ error: "Message is required" });
    }

    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return res.status(500).json({
        error: "GEMINI_API_KEY is not configured"
      });
    }

    const models = [
      "gemini-3.8-flash",
      "gemini-3.5-flash-lite"
    ];

    let lastError = "Gemini API error";

    for (const model of models) {
      try {
        const response = await fetch(
          "https://generativelanguage.googleapis.com/v1beta/interactions",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-goog-api-key": apiKey
            },
            body: JSON.stringify({
              model: model,
              input: message,
              store: false
            })
          }
        );

        const data = await response.json();

        if (response.ok) {
          const reply = data?.output_text;

          if (reply) {
            return res.status(200).json({
              reply,
              model
            });
          }
        }

        lastError =
          data?.error?.message ||
          `Model ${model} failed`;

        // अगले model पर केवल temporary availability/rate-limit
        // जैसी समस्या में जाएँ
        if (response.status !== 429 && response.status !== 503) {
          break;
        }

      } catch (error) {
        lastError = error.message || "Request failed";
      }
    }

    return res.status(503).json({
      error: lastError
    });

  } catch (error) {
    return res.status(500).json({
      error: error.message || "Server error"
    });
  }
}
