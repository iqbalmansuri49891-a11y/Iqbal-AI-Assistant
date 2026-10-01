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

    const geminiKey = process.env.GEMINI_API_KEY;
    const openRouterKey = process.env.OPENROUTER_API_KEY;

    if (!geminiKey && !openRouterKey) {
      return res.status(500).json({
        error:
          "API key missing. Vercel Environment Variables में GEMINI_API_KEY या OPENROUTER_API_KEY डालें।"
      });
    }

    const text = (message || "").toLowerCase();

    // ==================================================
    // IMAGE GENERATION REQUEST DETECTION
    // ==================================================

    const wantsImage =
      text.includes("image banao") ||
      text.includes("image bana") ||
      text.includes("image बनाओ") ||
      text.includes("image बना") ||
      text.includes("photo banao") ||
      text.includes("photo bana") ||
      text.includes("photo बनाओ") ||
      text.includes("photo बना") ||
      text.includes("tasveer banao") ||
      text.includes("tasveer bana") ||
      text.includes("तस्वीर बनाओ") ||
      text.includes("चित्र बनाओ") ||
      text.includes("picture banao") ||
      text.includes("picture bana") ||
      text.includes("generate image") ||
      text.includes("create image") ||
      text.includes("make an image") ||
      text.includes("draw an image") ||
      text.includes("generate a picture") ||
      text.includes("create a picture");

    // ==================================================
    // GEMINI IMAGE GENERATION
    // ==================================================

    if (wantsImage && geminiKey) {
      try {
        const imageResponse = await fetch(
          "https://generativelanguage.googleapis.com/v1beta/interactions",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-goog-api-key": geminiKey
            },
            body: JSON.stringify({
              model: "gemini-3.1-flash-image",
              input: message,
              response_format: {
                type: "image",
                mime_type: "image/png",
                aspect_ratio: "1:1",
                image_size: "1K"
              },
              store: false
            })
          }
        );

        const data = await imageResponse.json();

        if (!imageResponse.ok) {
          console.log(
            "Gemini image error:",
            data?.error?.message || data
          );
        } else {
          let generatedImage = null;
          let reply = data?.output_text || "";

          // Direct output_image
          if (data?.output_image?.data) {
            generatedImage = {
              data: data.output_image.data,
              mime_type:
                data.output_image.mime_type || "image/png"
            };
          }

          // Check model output steps
          if (!generatedImage && Array.isArray(data?.steps)) {
            for (const step of data.steps) {
              if (step?.type !== "model_output") continue;

              if (Array.isArray(step.content)) {
                for (const item of step.content) {
                  if (
                    item?.type === "text" &&
                    item?.text
                  ) {
                    reply += item.text;
                  }

                  if (
                    item?.type === "image" &&
                    item?.data
                  ) {
                    generatedImage = {
                      data: item.data,
                      mime_type:
                        item.mime_type || "image/png"
                    };
                  }
                }
              }
            }
          }

          if (generatedImage) {
            return res.status(200).json({
              reply:
                reply.trim() ||
                "आपकी image तैयार है।",
              image: generatedImage,
              provider: "gemini-image"
            });
          }
        }
      } catch (error) {
        console.log(
          "Gemini image failed:",
          error.message
        );
      }
    }

    // ==================================================
    // NORMAL GEMINI CHAT / IMAGE UNDERSTANDING
    // ==================================================

    if (geminiKey) {
      try {
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
              "x-goog-api-key": geminiKey
            },
            body: JSON.stringify({
              model: "gemini-3.8-flash",
              input,
              store: false
            })
          }
        );

        const data = await response.json();

        if (response.ok) {
          let reply = "";

          if (Array.isArray(data?.steps)) {
            for (const step of data.steps) {
              if (
                step?.type === "model_output" &&
                Array.isArray(step.content)
              ) {
                for (const item of step.content) {
                  if (
                    item?.type === "text" &&
                    item?.text
                  ) {
                    reply += item.text;
                  }
                }
              }
            }
          }

          if (!reply && data?.output_text) {
            reply = data.output_text;
          }

          if (reply.trim()) {
            return res.status(200).json({
              reply: reply.trim(),
              provider: "gemini"
            });
          }
        }

        console.log(
          "Gemini unavailable:",
          data?.error?.message || "Unknown Gemini error"
        );
      } catch (error) {
        console.log(
          "Gemini failed:",
          error.message
        );
      }
    }

    // ==================================================
    // OPENROUTER FALLBACK
    // ==================================================

    if (openRouterKey) {
      try {
        const content = [];

        if (message) {
          content.push({
            type: "text",
            text: message
          });
        }

        if (image) {
          content.push({
            type: "image_url",
            image_url: {
              url:
                `data:${image.mime_type};base64,${image.data}`
            }
          });
        }

        const response = await fetch(
          "https://openrouter.ai/api/v1/chat/completions",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization":
                `Bearer ${openRouterKey}`,
              "HTTP-Referer":
                "https://iqbal-ai.vercel.app",
              "X-Title": "Iqbal AI"
            },
            body: JSON.stringify({
              model: "openrouter/free",
              messages: [
                {
                  role: "user",
                  content
                }
              ]
            })
          }
        );

        const data = await response.json();

        if (!response.ok) {
          console.log(
            "OpenRouter error:",
            data?.error?.message || data
          );

          return res.status(500).json({
            error:
              "Gemini limit reached और OpenRouter भी unavailable है।"
          });
        }

        const reply =
          data?.choices?.[0]?.message?.content;

        if (!reply) {
          return res.status(500).json({
            error:
              "OpenRouter ने कोई response नहीं दिया।"
          });
        }

        return res.status(200).json({
          reply: reply.trim(),
          provider: "openrouter"
        });
      } catch (error) {
        console.log(
          "OpenRouter failed:",
          error.message
        );

        return res.status(500).json({
          error:
            "दोनों AI services अभी unavailable हैं।"
        });
      }
    }

    return res.status(500).json({
      error: "AI service unavailable."
    });

  } catch (error) {
    console.error("Server error:", error);

    return res.status(500).json({
      error:
        error.message || "Server error"
    });
  }
}
