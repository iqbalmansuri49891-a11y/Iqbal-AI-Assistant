export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { message, image } = req.body || {};

    if (!message && !image) {
      return res.status(400).json({
        error: "Message or image is required"
      });
    }

    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return res.status(500).json({
        error: "GEMINI_API_KEY is not configured"
      });
    }

    const input = [];

    if (message) {
      input.push({
        type: "text",
        text: message
      });
    }

    if (image) {
      input.push({
        type: "image",
        data: image.data,
        mime_type: image.mime_type
      });
    }

    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/interactions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey
        },
        body: JSON.stringify({
          model: "gemini-3.8-flash",
          input: input,
          store: false
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        error: data?.error?.message || "Gemini API error"
      });
    }

    let reply = "";

    if (Array.isArray(data?.steps)) {
      for (const step of data.steps) {
        if (
          step?.type === "model_output" &&
          Array.isArray(step.content)
        ) {
          for (const item of step.content) {
            if (item?.type === "text" && item?.text) {
              reply += item.text;
            }
          }
        }
      }
    }

    if (!reply && data?.output_text) {
      reply = data.output_text;
    }

    if (!reply) {
      return res.status(500).json({
        error: "Gemini returned no text response",
        details: data
      });
    }

    return res.status(200).json({
      reply: reply.trim()
    });

  } catch (error) {
    return res.status(500).json({
      error: error.message || "Server error"
    });
  }
}
