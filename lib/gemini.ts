import { generationWithRetry } from "@/lib/generation-retry";

// Try the configured model first, then fall back. Overload (503) and per-model
// quota (429) affect a single model, so another model can still serve the request.
const DEFAULT_MODELS = ["gemini-3.8-flash", "gemini-3.5-flash-lite", "gemini-3.1-flash-lite"];

function geminiModels() {
  const configured = (process.env.GEMINI_MODEL || "").split(",").map(value => value.trim()).filter(Boolean);
  return configured.length ? configured : DEFAULT_MODELS;
}

/** The ordered list of models this request will try. */
export function geminiModelList() {
  return geminiModels();
}

type Part = { text: string } | { inlineData: { mimeType: string; data: string } };
type GeminiOutcome = { text: string } | { error: string; status: number };

function messageForStatus(status?: number) {
  return status === 429 ? "AI quota is currently used up. Please try later."
    : status === 503 ? "The AI models are busy right now. Please try again in a minute."
    : status === 404 ? "The configured AI model is unavailable. Please update GEMINI_MODEL."
    : status === 401 || status === 403 ? "Gemini access was denied. Please check the server API key and project permissions."
    : "AI generation failed. Please try again later.";
}

/** Calls Gemini with the configured model fallback and returns the plain text answer. */
export async function geminiText(parts: Part[], maxOutputTokens = 2048): Promise<GeminiOutcome> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return { error: "AI generation isn’t configured yet. Please try again later.", status: 503 };
  let response: Response | undefined;
  for (const model of geminiModels()) {
    try {
      const attempt = await generationWithRetry(() => fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
        method: "POST", headers: { "Content-Type": "application/json", "x-goog-api-key": key },
        body: JSON.stringify({ contents: [{ parts }], generationConfig: { maxOutputTokens, ...(model.startsWith("gemini-3.") ? { thinkingConfig: { thinkingLevel: "low" } } : {}) } }),
        signal: AbortSignal.timeout(60000), cache: "no-store",
      }));
      response = attempt;
      if (attempt.ok) break;
      // Log status only: provider responses can contain sensitive configuration.
      console.error("Gemini request failed", { status: attempt.status, model });
      if (![404, 429, 503].includes(attempt.status)) break;
      await attempt.body?.cancel();
    } catch {
      console.error("Gemini request errored", { model });
      response = undefined;
    }
  }
  if (!response?.ok) return { error: messageForStatus(response?.status), status: 503 };
  const result = await response.json();
  const candidate = result.candidates?.[0];
  const text = candidate?.content?.parts?.filter((part: { thought?: boolean }) => !part.thought).map((part: { text?: string }) => part.text || "").join("").trim();
  if (candidate?.finishReason !== "STOP" || !text) return { error: "No usable text was generated.", status: 422 };
  return { text };
}

/** Asks Gemini's vision model for a short library description of an uploaded image. */
export function describeImage(bytes: Uint8Array, mime: string) {
  const prompt = "Describe this image in one short, factual phrase (max 100 characters) for a photo memory diary. Focus on what is depicted and any text in the image. Return only the description.";
  return geminiText([{ text: prompt }, { inlineData: { mimeType: mime, data: Buffer.from(bytes).toString("base64") } }]);
}
