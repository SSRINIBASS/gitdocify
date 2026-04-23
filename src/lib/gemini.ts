/**
 * Gitdocify — BYOK Gemini Client
 *
 * Per-request Gemini client using the user's own API key.
 * Supports embeddings (text-embedding-004), completions (Gemini 2.0 Flash),
 * and streaming completions for the tutor chat.
 */

import { GoogleGenerativeAI, type GenerateContentResult } from "@google/generative-ai";

const EMBEDDING_MODEL = "text-embedding-004";
const CHAT_MODEL = "gemini-2.0-flash";

/**
 * Create a Gemini client using the user's decrypted API key.
 */
export function createGeminiClient(apiKey: string) {
  return new GoogleGenerativeAI(apiKey);
}

/**
 * Generate a single embedding vector (768 dimensions).
 */
export async function generateEmbedding(
  text: string,
  apiKey: string
): Promise<number[]> {
  const genAI = createGeminiClient(apiKey);
  const model = genAI.getGenerativeModel({ model: EMBEDDING_MODEL });

  const result = await model.embedContent(text);
  return result.embedding.values;
}

/**
 * Generate embeddings for a batch of texts.
 * Handles rate limiting with sequential processing and delays.
 */
export async function generateEmbeddingsBatch(
  texts: string[],
  apiKey: string,
  batchSize: number = 20,
  delayMs: number = 100
): Promise<number[][]> {
  const genAI = createGeminiClient(apiKey);
  const model = genAI.getGenerativeModel({ model: EMBEDDING_MODEL });

  const embeddings: number[][] = [];

  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);
    const results = await Promise.all(
      batch.map(async (text) => {
        const result = await model.embedContent(text);
        return result.embedding.values;
      })
    );
    embeddings.push(...results);

    // Rate limiting delay between batches
    if (i + batchSize < texts.length) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  return embeddings;
}

/**
 * Generate a completion using Gemini 2.0 Flash.
 * Used for documentation generation and structured responses.
 */
export async function generateCompletion(
  prompt: string,
  systemInstruction: string,
  apiKey: string,
  temperature: number = 0.3
): Promise<string> {
  const genAI = createGeminiClient(apiKey);
  const model = genAI.getGenerativeModel({
    model: CHAT_MODEL,
    systemInstruction,
    generationConfig: {
      temperature,
      maxOutputTokens: 8192,
    },
  });

  const result: GenerateContentResult = await model.generateContent(prompt);
  return result.response.text();
}

/**
 * Generate a streaming completion for the tutor chat.
 * Returns a ReadableStream of text chunks.
 */
export async function streamCompletion(
  prompt: string,
  systemInstruction: string,
  apiKey: string,
  temperature: number = 0.3
): Promise<ReadableStream<Uint8Array>> {
  const genAI = createGeminiClient(apiKey);
  const model = genAI.getGenerativeModel({
    model: CHAT_MODEL,
    systemInstruction,
    generationConfig: {
      temperature,
      maxOutputTokens: 4096,
    },
  });

  const result = await model.generateContentStream(prompt);

  const encoder = new TextEncoder();

  return new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of result.stream) {
          const text = chunk.text();
          if (text) {
            controller.enqueue(encoder.encode(text));
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
