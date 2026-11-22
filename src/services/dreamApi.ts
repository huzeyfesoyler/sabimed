import type {
  ChatMessage,
  ChatModelId,
  DreamEntry,
  DreamInterpretationResponse,
  ImageAspectRatio,
  ImageResolution,
} from "../types/dream";

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const data = (await response.json().catch(() => ({}))) as { error?: string } & T;

  if (!response.ok) {
    throw new Error(data.error || `Request failed with status ${response.status}`);
  }

  return data;
}

export async function transcribeDreamAudio(
  audioBase64: string,
  mimeType: string
): Promise<{ transcript: string }> {
  return postJson<{ transcript: string }>("/api/dreams/transcribe", {
    audioBase64,
    mimeType,
  });
}

export async function interpretDreamTranscript(
  transcript: string
): Promise<DreamInterpretationResponse> {
  return postJson<DreamInterpretationResponse>("/api/dreams/interpret", {
    transcript,
  });
}

export async function generateDreamArtwork(params: {
  imagePrompt: string;
  imageSize: ImageResolution;
  aspectRatio: ImageAspectRatio;
}): Promise<{
  imageDataUrl: string;
  imageSize: ImageResolution;
  aspectRatio: ImageAspectRatio;
}> {
  return postJson("/api/dreams/image", params);
}

export async function sendDreamChatMessage(params: {
  dream: DreamEntry;
  history: ChatMessage[];
  message: string;
  model: ChatModelId;
}): Promise<{ reply: string; model: ChatModelId }> {
  return postJson("/api/dreams/chat", {
    dreamContext: {
      title: params.dream.title,
      transcript: params.dream.transcript,
      coreEmotionalTheme: params.dream.coreEmotionalTheme,
      emotionalTone: params.dream.emotionalTone,
      summary: params.dream.summary,
      tags: params.dream.tags,
      archetypes: params.dream.archetypes,
      symbols: params.dream.symbols,
    },
    history: params.history.map((m) => ({
      role: m.role,
      text: m.text,
    })),
    message: params.message,
    model: params.model,
  });
}
