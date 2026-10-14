// Retry transient failures up to four times per model.
// Only transient network/server failures are retried, never auth or quota errors.
export async function generationWithRetry(
  request: () => Promise<Response>,
  wait: (ms: number) => Promise<void> = ms => new Promise(resolve => setTimeout(resolve, ms)),
) {
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const response = await request();
      if (![500, 502, 503, 504].includes(response.status) || attempt === 3) return response;
      await response.body?.cancel();
    } catch (error) {
      if (attempt === 3) throw error;
    }
    await wait(1000 * (attempt + 1));
  }
  throw new Error("Generation attempts exhausted.");
}
