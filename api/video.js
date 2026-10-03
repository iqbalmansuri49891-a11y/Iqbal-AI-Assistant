import { InferenceClient } from "@huggingface/inference";

export default async function handler(req, res) {

  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed"
    });
  }

  try {

    const { prompt } = req.body || {};

    if (!prompt || !prompt.trim()) {
      return res.status(400).json({
        error: "Video prompt डालो।"
      });
    }

    const token = process.env.HF_TOKEN;

    if (!token) {
      return res.status(500).json({
        error: "HF_TOKEN Vercel में नहीं मिला।"
      });
    }

    const hf = new InferenceClient(token);

    const video = await hf.textToVideo(
      {
        model: "Wan-AI/Wan2.1-T2V-1.3B",
        inputs: prompt.trim()
      },
      {
        provider: "fal-ai"
      }
    );

    const buffer = Buffer.from(
      await video.arrayBuffer()
    );

    return res.status(200).json({
      success: true,
      video: buffer.toString("base64"),
      mime_type: video.type || "video/mp4"
    });

  } catch (error) {

    console.error("VIDEO ERROR:", error);

    const msg = String(
      error?.message || error
    );

    if (
      /credit|credits|billing|payment|balance|quota|exhausted|insufficient|limit/i.test(msg)
    ) {

      return res.status(402).json({
        locked: true,
        error: "🔒 Free video limit खत्म हो गई है।"
      });
    }

    return res.status(500).json({
      error: msg || "Video नहीं बन पाया।"
    });
  }
}
