import { InferenceClient } from "@huggingface/inference";

export default async function handler(req, res) {
  // Only POST
  if (req.method !== "POST") {
    return res.status(405).json({
      success: false,
      error: "Method not allowed"
    });
  }

  try {
    const { prompt } = req.body || {};

    // Check prompt
    if (typeof prompt !== "string" || !prompt.trim()) {
      return res.status(400).json({
        success: false,
        error: "Video prompt डालो।"
      });
    }

    // Get Hugging Face key from Vercel
    const token = process.env.HUGGINGFACE_API_KEY;

    if (!token) {
      console.error("HUGGINGFACE_API_KEY missing");

      return res.status(500).json({
        success: false,
        error: "HUGGINGFACE_API_KEY Vercel में नहीं मिला।"
      });
    }

    console.log("Starting video generation...");

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

    if (!video) {
      return res.status(500).json({
        success: false,
        error: "Video response नहीं मिला।"
      });
    }

    const arrayBuffer = await video.arrayBuffer();

    if (!arrayBuffer || arrayBuffer.byteLength === 0) {
      return res.status(500).json({
        success: false,
        error: "Video खाली मिला।"
      });
    }

    const buffer = Buffer.from(arrayBuffer);

    console.log(
      "Video generated:",
      buffer.length,
      "bytes"
    );

    return res.status(200).json({
      success: true,
      video: buffer.toString("base64"),
      mime_type: video.type || "video/mp4"
    });

  } catch (error) {
    console.error("VIDEO ERROR:", error);

    const message =
      error?.message ||
      error?.error ||
      String(error);

    // Hugging Face / provider limits
    if (
      /credit|credits|billing|payment|balance|quota|exhausted|insufficient|limit|429/i.test(
        message
      )
    ) {
      return res.status(402).json({
        success: false,
        locked: true,
        error:
          "🔒 Video generation की limit/credits उपलब्ध नहीं हैं।"
      });
    }

    return res.status(500).json({
      success: false,
      error: "Video नहीं बन पाया।",
      details: message
    });
  }
}
