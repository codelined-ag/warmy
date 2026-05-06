export interface WarmupResult {
  success: boolean;
  reply: string | null;
  error: string | null;
}

export const WARMUP_INTERVAL_SECONDS = 5 * 60 * 60 + 60; // 5hrs + 1min

export async function handleResponseError(
  response: Response,
  prefix: string
): Promise<WarmupResult | null> {
  if (!response.ok) {
    const text = await response.text();
    return {
      success: false,
      reply: null,
      error: `${prefix} API error: ${response.status} ${response.statusText} — ${text}`,
    };
  }
  return null;
}

export function handleCatchError(err: unknown): WarmupResult {
  return {
    success: false,
    reply: null,
    error: err instanceof Error ? err.message : String(err),
  };
}