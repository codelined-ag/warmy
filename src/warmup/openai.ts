const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";

const DEFAULT_WARMUP_MESSAGE =
  "Hello! This is an automated warm-up message. Please just say 'Warmed up!' in response.";

export interface WarmupResult {
  success: boolean;
  reply: string | null;
  error: string | null;
}

export async function warmupOpenAI(
  apiKey: string,
  message: string = DEFAULT_WARMUP_MESSAGE
): Promise<WarmupResult> {
  try {
    const response = await fetch(OPENAI_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        max_tokens: 64,
        messages: [{ role: "user", content: message }],
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      return {
        success: false,
        reply: null,
        error: `OpenAI API error: ${response.status} ${response.statusText} — ${text}`,
      };
    }

    const data = (await response.json()) as {
      choices: Array<{ message: { content: string } }>;
    };

    const reply = data.choices[0]?.message?.content ?? "(no text)";

    return { success: true, reply, error: null };
  } catch (err) {
    return {
      success: false,
      reply: null,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
