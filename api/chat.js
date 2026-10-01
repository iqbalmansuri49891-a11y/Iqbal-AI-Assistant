export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { message, image } = req.body || {};

    if (!message && !image) {
      return res.status(400).json({
        error: "Message or image is required."
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

    const text = String(message || "").toLowerCase();

    // =====================================================
    // IMAGE GENERATION DETECTION
    // =====================================================

    const wantsImage =
      /image\s*(banao|bana|banाओ|बनाओ|बना)|photo\s*(banao|bana|बनाओ|बना)|picture\s*(banao|bana|बनाओ|बना)|tasveer\s*(banao|bana)|तस्वीर\s*(बनाओ|बना)|चित्र\s*(बनाओ|बना)|इमेज\s*(बनाओ|बना)|generate\s+(an?\s+)?image|create\s+(an?\s+)?image|make\s+(an?\s+)?image|draw\s+(an?\s+)?image/i
      .test(text);

    // =====================================================
    // IMAGE GENERATION
    // IMPORTANT: DO NOT FALL BACK TO TEXT AI
    // =====================================================

    if (wantsImage) {

      if (!geminiKey) {
        return res.status(500).json({
          error:
            "Image generation के लिए GEMINI_API_KEY जरूरी है।"
        });
      }

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

              input: [
                {
                  type: "text",
                  text: message
                }
              ],

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

        console.log(
          "Gemini image status:",
          imageResponse.status
        );

        if (!imageResponse.ok) {
          console.error(
            "Gemini image error:",
            data?.error || data
          );

          return res.status(500).json({
            error:
              data?.error?.message ||
              "Gemini image generation failed."
          });
        }

        // ===============================================
        // DIRECT OUTPUT IMAGE
        // ===============================================

        if (data?.output_image?.data) {
          return res.status(200).json({
            reply:
              data?.output_text ||
              "आपकी image तैयार है।",

            image: {
              data: data.output_image.data,
              mime_type:
                data.output_image.mime_type ||
                "image/png"
            },

            provider: "gemini-image"
          });
        }

        // ===============================================
        // STEPS IMAGE
        // ===============================================

        let generatedImage = null;
        let generatedText = "";

        if (Array.isArray(data?.steps)) {

          for (const step of data.steps) {

            if (step?.type !== "model_output") {
              continue;
            }

            if (!Array.isArray(step.content)) {
              continue;
            }

            for (const item of step.content) {

              if (
                item?.type === "image" &&
                item?.data
              ) {
                generatedImage = {
                  data: item.data,
                  mime_type:
                    item.mime_type ||
                    "image/png"
                };
              }

              if (
                item?.type === "text" &&
                item?.text
              ) {
                generatedText += item.text;
              }
            }
          }
        }

        if (generatedImage) {
          return res.status(200).json({
            reply:
              generatedText.trim() ||
              "आपकी image तैयार है।",

            image: generatedImage,

            provider: "gemini-image"
          });
        }

        // ===============================================
        // NO IMAGE RECEIVED
        // DO NOT SEND TO NORMAL CHAT
        // ===============================================

        console.error(
          "Gemini returned no image:",
          JSON.stringify(data)
        );

        return res.status(500).json({
          error:
            "Gemini ने response दिया लेकिन generated image नहीं मिली।"
        });

      } catch (error) {

        console.error(
          "Image generation exception:",
          error
        );

        return res.status(500).json({
          error:
            "Image generation failed: " +
            error.message
        });
      }
    }

    // =====================================================
    // NORMAL GEMINI CHAT / PHOTO UNDERSTANDING
    // =====================================================

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

          if (data?.output_text) {
            reply = data.output_text;
          }

          if (!reply && Array.isArray(data?.steps)) {

            for (const step of data.steps) {

              if (
                step?.type !== "model_output" ||
                !Array.isArray(step.content)
              ) {
                continue;
              }

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

          if (reply.trim()) {

            return res.status(200).json({
              reply: reply.trim(),
              provider: "gemini"
            });
          }
        }

        console.log(
          "Gemini unavailable:",
          data?.error?.message || data
        );

      } catch (error) {

        console.log(
          "Gemini failed:",
          error.message
        );
      }
    }

    // =====================================================
    // OPENROUTER FALLBACK
    // NORMAL CHAT ONLY
    // =====================================================

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
              "X-Title":
                "Iqbal AI"
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

          return res.status(500).json({
            error:
              data?.error?.message ||
              "OpenRouter unavailable."
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

    console.error(
      "Server error:",
      error
    );

    return res.status(500).json({
      error:
        error.message ||
        "Server error"
    });
  }
}
