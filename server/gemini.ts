import { GoogleGenAI } from "@google/genai";

let cachedClient: GoogleGenAI | null = null;
let cachedApiKey: string | undefined;

export function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new GeminiApiHttpError(
      503,
      "Gemini API key is not configured. Open Settings > Secrets to select or configure a billing-enabled API key."
    );
  }

  if (!cachedClient || cachedApiKey !== apiKey) {
    cachedClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
    cachedApiKey = apiKey;
  }

  return cachedClient;
}

export class GeminiApiHttpError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = "GeminiApiHttpError";
  }
}

export async function withRetry<T>(
  operation: () => Promise<T>,
  maxAttempts = 2
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      const status = extractStatusCode(error);
      const isTransient = status === 500 || status === 502 || status === 503 || status === 504;
      if (!isTransient || attempt === maxAttempts) {
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, 600 * attempt));
    }
  }
  throw lastError;
}

function extractStatusCode(error: unknown): number {
  if (error instanceof GeminiApiHttpError) {
    return error.status;
  }
  if (typeof error === "object" && error !== null) {
    const errObj = error as { status?: number; statusCode?: number; code?: number };
    if (typeof errObj.status === "number") return errObj.status;
    if (typeof errObj.statusCode === "number") return errObj.statusCode;
    if (typeof errObj.code === "number" && errObj.code >= 400 && errObj.code < 600) {
      return errObj.code;
    }
  }
  return 500;
}

export function formatGeminiError(error: unknown): { status: number; message: string } {
  if (error instanceof GeminiApiHttpError) {
    return { status: error.status, message: error.message };
  }

  const rawMessage = error instanceof Error ? error.message : String(error);
  const status = extractStatusCode(error);

  if (
    status === 403 ||
    rawMessage.includes("PERMISSION_DENIED") ||
    rawMessage.includes("API_KEY_INVALID")
  ) {
    return {
      status: status === 403 ? 403 : 400,
      message:
        "The configured Gemini API key lacks permission or is invalid. Please check or select a valid billing-enabled key in Settings > Secrets.",
    };
  }

  if (status === 429 || rawMessage.includes("RESOURCE_EXHAUSTED")) {
    return {
      status: 429,
      message:
        "Rate limit or quota reached for this model. Select a billing-enabled API key in Settings > Secrets or retry in a moment.",
    };
  }

  if (status === 404 || rawMessage.includes("NOT_FOUND")) {
    return {
      status: 404,
      message: `Requested model is currently unavailable for this API key: ${rawMessage}`,
    };
  }

  return {
    status: status >= 400 && status < 600 ? status : 500,
    message: rawMessage || "An unexpected error occurred while contacting Gemini.",
  };
}
