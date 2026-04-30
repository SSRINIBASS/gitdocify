/**
 * Gitdocify — Generic LLM Client (Nvidia NIM)
 *
 * Uses standard REST fetch to connect to OpenAI-compatible endpoints.
 * Currently hardcoded to NVIDIA NIM's API.
 */

const NIM_BASE_URL = "https://integrate.api.nvidia.com/v1";
const CHAT_MODEL = "meta/llama-3.1-8b-instruct";

/**
 * Generate a completion using an OpenAI-compatible API.
 */
export async function generateCompletion(
  prompt: string,
  systemInstruction: string,
  apiKey: string,
  temperature: number = 0.3
): Promise<string> {
  const response = await fetch(`${NIM_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: CHAT_MODEL,
      messages: [
        { role: "system", content: systemInstruction },
        { role: "user", content: prompt },
      ],
      temperature,
      max_tokens: 8192,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    // Catch rate limits explicitly
    if (response.status === 429) {
      console.warn(`[llm] Rate limit hit for ${CHAT_MODEL}. Returning fallback content.`);
      return "⚠️ **Generation Skipped (Rate Limit)**\n\nThe LLM API rate limits were exceeded during this generation step. However, your repository code has been successfully indexed and you can still use the AI Tutor for chat!";
    }
    throw new Error(`[NVIDIA NIM Error]: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  return data.choices[0]?.message?.content || "";
}

/**
 * Generate a streaming completion for the tutor chat using Server-Sent Events.
 */
export async function streamCompletion(
  prompt: string,
  systemInstruction: string,
  apiKey: string,
  temperature: number = 0.3
): Promise<ReadableStream<Uint8Array>> {
  const response = await fetch(`${NIM_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: CHAT_MODEL,
      messages: [
        { role: "system", content: systemInstruction },
        { role: "user", content: prompt },
      ],
      temperature,
      max_tokens: 4096,
      stream: true,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`[NVIDIA NIM Error]: ${response.status} - ${errorText}`);
  }

  if (!response.body) {
    throw new Error("Response body is null");
  }

  // Parse SSE stream
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();

  return new ReadableStream({
    async start(controller) {
      let buffer = "";
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || ""; // keep incomplete line in buffer

          for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed.startsWith("data: ") && trimmed !== "data: [DONE]") {
              try {
                const data = JSON.parse(trimmed.slice(6));
                const content = data.choices[0]?.delta?.content;
                if (content) {
                  controller.enqueue(encoder.encode(content));
                }
              } catch (e) {
                console.warn("Failed to parse SSE data line:", trimmed);
              }
            }
          }
        }
        controller.close();
      } catch (error) {
        controller.error(error);
      }
    },
  });
}

/**
 * Simple token count estimation (~1.3 tokens per word).
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.split(/\s+/).length * 1.3);
}
