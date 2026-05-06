const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";

const DEFAULT_WARMUP_MESSAGE =
  "Hello! This is an automated warm-up message to reset my Claude Code rate limit window. Please just say 'Warmed up!' in response.";

export interface WarmupResult {
  success: boolean;
  reply: string | null;
  error: string | null;
}

export async function warmupAnthropic(
  apiKey: string,
  message: string = DEFAULT_WARMUP_MESSAGE
): Promise<WarmupResult> {
  try {
    const response = await fetch(ANTHROPIC_API_URL, {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "Content-Type": "application/json",
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 64,
        messages: [{ role: "user", content: message }],
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      return {
        success: false,
        reply: null,
        error: `Anthropic API error: ${response.status} ${response.statusText} — ${text}`,
      };
    }

    const data = (await response.json()) as {
      content: Array<{ type: string; text: string }>;
    };

    const textBlock = data.content?.find((b) => b.type === "text");
    const reply = textBlock?.text ?? "(no text)";

    return { success: true, reply, error: null };
  } catch (err) {
    return {
      success: false,
      reply: null,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
