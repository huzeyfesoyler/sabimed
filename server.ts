import "dotenv/config";
import express from "express";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Type } from "@google/genai";
import {
  formatGeminiError,
  GeminiApiHttpError,
  getGeminiClient,
  withRetry,
} from "./server/gemini.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ALLOWED_CHAT_MODELS = new Set([
  "gemini-4-hydrogen",
  "gemini-4-carbon",
  "gemini-4-neon",
  "gemini-3.1-flash-lite",
]);

const ALLOWED_IMAGE_SIZES = new Set(["1K", "2K", "4K"]);
const ALLOWED_ASPECT_RATIOS = new Set(["16:9", "4:3", "1:1", "3:4"]);

interface ChatHistoryItem {
  role: "user" | "model";
  text: string;
}

interface DreamContextPayload {
  title?: string;
  transcript?: string;
  coreEmotionalTheme?: string;
  emotionalTone?: string[];
  summary?: string;
  tags?: string[];
  archetypes?: Array<{
    name: string;
    manifestation: string;
    psychologicalMeaning: string;
  }>;
  symbols?: Array<{
    symbol: string;
    context: string;
    meaning: string;
  }>;
}

function buildDreamAnalystInstruction(dream: DreamContextPayload): string {
  const archetypesBlock = (dream.archetypes ?? [])
    .map((a) => `- ${a.name}: ${a.manifestation} (${a.psychologicalMeaning})`)
    .join("\n");

  const symbolsBlock = (dream.symbols ?? [])
    .map((s) => `- ${s.symbol}: ${s.context} — ${s.meaning}`)
    .join("\n");

  const tagsLine = (dream.tags ?? []).length > 0 ? (dream.tags ?? []).join(", ") : "None";

  return [
    "You are an insightful, grounded analytical psychologist trained in Jungian depth psychology and symbolic dream analysis.",
    "You are speaking directly with the dreamer inside their private Dream Journal about one specific dream entry.",
    "Guidelines:",
    "- Anchor every response in the concrete imagery, narrative moments, emotions, and symbols from this dream transcript.",
    "- Draw thoughtfully on Jungian archetypes (Shadow, Anima/Animus, Self, Persona, Wise Old Man/Woman, Trickster, Threshold Guardian, Great Mother, etc.) and comparative symbolism without sounding mechanical or dogmatic.",
    "- Treat dream interpretations as reflective invitations rather than rigid predictions; ask gentle clarifying questions when exploring personal associations.",
    "- Keep responses clear, literary, and well-structured (2 to 4 concise paragraphs or short structured reflections unless the user asks for an exhaustive essay).",
    "",
    "ACTIVE DREAM DOSSIER:",
    `Title: ${dream.title ?? "Untitled Dream"}`,
    `Core Emotional Theme: ${dream.coreEmotionalTheme ?? "Unclassified"}`,
    `Emotional Tones: ${(dream.emotionalTone ?? []).join(", ") || "Not specified"}`,
    `User Tags: ${tagsLine}`,
    `Transcript:\n"""\n${dream.transcript ?? ""}\n"""`,
    archetypesBlock ? `Identified Archetypes:\n${archetypesBlock}` : "",
    symbolsBlock ? `Identified Symbols:\n${symbolsBlock}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

async function createServer() {
  const app = express();
  app.use(express.json({ limit: "35mb" }));

  // 1. Transcribe voice recording via gemini-3.5-transcribe
  app.post("/api/dreams/transcribe", async (req, res) => {
    try {
      const { audioBase64, mimeType } = req.body as {
        audioBase64?: string;
        mimeType?: string;
      };

      if (!audioBase64 || typeof audioBase64 !== "string") {
        throw new GeminiApiHttpError(400, "Missing audioBase64 payload.");
      }

      const normalizedMime =
        typeof mimeType === "string" && mimeType.startsWith("audio/")
          ? mimeType.split(";")[0]
          : "audio/webm";

      const ai = getGeminiClient();
      const response = await withRetry(() =>
        ai.models.generateContent({
          model: "gemini-3.5-transcribe",
          contents: {
            parts: [
              {
                inlineData: {
                  mimeType: normalizedMime,
                  data: audioBase64,
                },
              },
              {
                text: "Transcribe this spoken dream recording faithfully and accurately. Preserve natural phrasing, sensory imagery, and emotional nuance without inventing details. Return only the clean transcript text.",
              },
            ],
          },
        })
      );

      const transcript = (response.text ?? "").trim();
      if (!transcript) {
        throw new GeminiApiHttpError(
          422,
          "No speech was detected in the recording. Please try speaking closer to the microphone or type your dream directly."
        );
      }

      res.json({ transcript });
    } catch (error) {
      const formatted = formatGeminiError(error);
      res.status(formatted.status).json({ error: formatted.message });
    }
  });

  // 2. Structured Jungian Psychological Interpretation + Surrealist Art Direction
  app.post("/api/dreams/interpret", async (req, res) => {
    try {
      const { transcript } = req.body as { transcript?: string };

      if (!transcript || typeof transcript !== "string" || transcript.trim().length < 10) {
        throw new GeminiApiHttpError(
          400,
          "Please provide a dream description of at least a few words to interpret."
        );
      }

      const ai = getGeminiClient();
      const response = await withRetry(() =>
        ai.models.generateContent({
          model: "gemini-4-neon",
          contents: `Analyze the following freshly recorded dream transcript and return a structured psychological interpretation rooted in Jungian archetypes, symbolic depth, and a museum-grade surrealist painting prompt capturing its core emotional theme.\n\nDream Transcript:\n"""\n${transcript.trim()}\n"""`,
          config: {
            systemInstruction:
              "You are a master Jungian analyst and fine-art surrealist curator. Produce nuanced, empathetic, psychologically grounded interpretations. For imagePrompt, craft a rich painterly surrealist oil painting description (evoking Remedios Varo, Rene Magritte, Leonora Carrington, or Giorgio de Chirico) that visually crystallizes the dream's core emotional atmosphere and central symbols, with deep nocturnal chiaroscuro, museum-grade composition, and strictly no text or letters in the artwork. For suggestedTags, provide 4 to 6 concise lowercase 1-2 word thematic tags (e.g. 'water', 'threshold', 'flying', 'childhood home', 'labyrinth').",
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                title: {
                  type: Type.STRING,
                  description: "An evocative literary title for the dream (3 to 6 words).",
                },
                coreEmotionalTheme: {
                  type: Type.STRING,
                  description:
                    "Concise distillation of the dream's core emotional theme (3 to 7 words).",
                },
                emotionalTone: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                  description: "2 to 3 nuanced emotional tones present in the dream.",
                },
                summary: {
                  type: Type.STRING,
                  description:
                    "2 to 3 sentence psychological synthesis of the dream's narrative arc and inner tension.",
                },
                imagePrompt: {
                  type: Type.STRING,
                  description:
                    "Detailed surrealist fine-art oil painting prompt depicting the dream's core emotional theme and key visual motifs, with no text or watermarks.",
                },
                archetypes: {
                  type: Type.ARRAY,
                  description: "2 to 4 recognized Jungian archetypes active in the dream.",
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      name: {
                        type: Type.STRING,
                        description:
                          "Recognized archetype name (e.g. The Shadow, The Anima, The Threshold Guardian, The Self, The Wise Old Man, The Trickster).",
                      },
                      manifestation: {
                        type: Type.STRING,
                        description:
                          "How this archetype specifically manifested in the dreamer's imagery or events.",
                      },
                      psychologicalMeaning: {
                        type: Type.STRING,
                        description:
                          "Thoughtful Jungian interpretation of what this archetype may be surfacing in waking life.",
                      },
                      integrationPrompt: {
                        type: Type.STRING,
                        description:
                          "One gentle, open-ended reflection question for the dreamer's waking contemplation.",
                      },
                    },
                    required: [
                      "name",
                      "manifestation",
                      "psychologicalMeaning",
                      "integrationPrompt",
                    ],
                  },
                },
                symbols: {
                  type: Type.ARRAY,
                  description: "3 to 6 resonant symbols extracted from the dream.",
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      symbol: {
                        type: Type.STRING,
                        description: "Concise name of the symbol (e.g. 'Flooded Observatory').",
                      },
                      context: {
                        type: Type.STRING,
                        description: "Brief note on how it appeared in the dream.",
                      },
                      meaning: {
                        type: Type.STRING,
                        description: "Psychological and archetypal significance of the symbol.",
                      },
                    },
                    required: ["symbol", "context", "meaning"],
                  },
                },
                suggestedTags: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                  description:
                    "4 to 6 concise lowercase tags categorizing key motifs, places, or themes.",
                },
              },
              required: [
                "title",
                "coreEmotionalTheme",
                "emotionalTone",
                "summary",
                "imagePrompt",
                "archetypes",
                "symbols",
                "suggestedTags",
              ],
            },
          },
        })
      );

      const rawText = (response.text ?? "").trim();
      if (!rawText) {
        throw new GeminiApiHttpError(502, "Received an empty interpretation response from Gemini.");
      }

      const parsed = JSON.parse(rawText);
      res.json(parsed);
    } catch (error) {
      const formatted = formatGeminiError(error);
      res.status(formatted.status).json({ error: formatted.message });
    }
  });

  // 3. Surrealist Image Generation via gemini-3-pro-image-preview (1K / 2K / 4K)
  app.post("/api/dreams/image", async (req, res) => {
    try {
      const { imagePrompt, imageSize, aspectRatio } = req.body as {
        imagePrompt?: string;
        imageSize?: string;
        aspectRatio?: string;
      };

      if (!imagePrompt || typeof imagePrompt !== "string" || !imagePrompt.trim()) {
        throw new GeminiApiHttpError(400, "Missing imagePrompt for surrealist artwork generation.");
      }

      const resolvedSize =
        typeof imageSize === "string" && ALLOWED_IMAGE_SIZES.has(imageSize)
          ? imageSize
          : "1K";
      const resolvedAspectRatio =
        typeof aspectRatio === "string" && ALLOWED_ASPECT_RATIOS.has(aspectRatio)
          ? aspectRatio
          : "16:9";

      const ai = getGeminiClient();
      const response = await withRetry(() =>
        ai.models.generateContent({
          model: "gemini-3-pro-image-preview",
          contents: {
            parts: [
              {
                text: `${imagePrompt.trim()}. Museum-grade fine-art surrealist oil painting on canvas, evocative atmospheric lighting, poetic symbolic composition, strictly no text, no letters, no signatures, no borders.`,
              },
            ],
          },
          config: {
            imageConfig: {
              aspectRatio: resolvedAspectRatio,
              imageSize: resolvedSize,
            },
          },
        })
      );

      const parts = response.candidates?.[0]?.content?.parts ?? [];
      let imageDataUrl: string | null = null;

      for (const part of parts) {
        if (part.inlineData?.data) {
          const mime = part.inlineData.mimeType ?? "image/png";
          imageDataUrl = `data:${mime};base64,${part.inlineData.data}`;
          break;
        }
      }

      if (!imageDataUrl) {
        throw new GeminiApiHttpError(
          502,
          "The image model returned no image data. Please try regenerating or adjusting the dream description."
        );
      }

      res.json({
        imageDataUrl,
        imageSize: resolvedSize,
        aspectRatio: resolvedAspectRatio,
      });
    } catch (error) {
      const formatted = formatGeminiError(error);
      res.status(formatted.status).json({ error: formatted.message });
    }
  });

  // 4. Multi-Turn Dream Symbol Chat
  app.post("/api/dreams/chat", async (req, res) => {
    try {
      const { dreamContext, history, message, model } = req.body as {
        dreamContext?: DreamContextPayload;
        history?: ChatHistoryItem[];
        message?: string;
        model?: string;
      };

      if (!message || typeof message !== "string" || !message.trim()) {
        throw new GeminiApiHttpError(400, "Message cannot be empty.");
      }

      const selectedModel =
        typeof model === "string" && ALLOWED_CHAT_MODELS.has(model)
          ? model
          : "gemini-4-hydrogen";

      const formattedHistory = Array.isArray(history)
        ? history
            .filter(
              (item): item is ChatHistoryItem =>
                (item.role === "user" || item.role === "model") &&
                typeof item.text === "string" &&
                item.text.trim().length > 0
            )
            .map((item) => ({
              role: item.role,
              parts: [{ text: item.text }],
            }))
        : [];

      const ai = getGeminiClient();
      const chat = ai.chats.create({
        model: selectedModel,
        history: formattedHistory,
        config: {
          systemInstruction: buildDreamAnalystInstruction(dreamContext ?? {}),
        },
      });

      const response = await withRetry(() =>
        chat.sendMessage({ message: message.trim() })
      );

      const reply = (response.text ?? "").trim();
      if (!reply) {
        throw new GeminiApiHttpError(502, "Received an empty reply from the dream analyst.");
      }

      res.json({ reply, model: selectedModel });
    } catch (error) {
      const formatted = formatGeminiError(error);
      res.status(formatted.status).json({ error: formatted.message });
    }
  });

  // Vite dev middleware or production static build
  const isProd = process.env.NODE_ENV === "production";
  if (!isProd) {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      const indexHtml = path.join(distPath, "index.html");
      if (fs.existsSync(indexHtml)) {
        res.sendFile(indexHtml);
      } else {
        res.status(404).send("Build output not found. Run npm run build first.");
      }
    });
  }

  const port = Number(process.env.PORT) || 3000;
  app.listen(port, "0.0.0.0", () => {
    console.log(`Oneira Dream Journal server listening on http://0.0.0.0:${port}`);
  });
}

createServer().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
