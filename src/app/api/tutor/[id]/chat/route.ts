/**
 * POST /api/tutor/[id]/chat — AI Tutor with anti-hallucination.
 *
 * Streams Gemini responses grounded in retrieved code context.
 * Every answer must cite file paths and line numbers.
 */

import { NextResponse } from "next/server";
import { db } from "@/db";
import {
  repositories,
  users,
  tutorSessions,
  tutorMessages,
} from "@/db/schema";
import { authenticateRequest } from "@/lib/auth";
import { eq, and, desc } from "drizzle-orm";
import { streamCompletion } from "@/lib/llm";
import { generateLocalEmbedding } from "@/lib/local-ai";
import { decrypt } from "@/lib/crypto";
import { searchSimilar } from "@/lib/vector-search";

const TUTOR_SYSTEM_PROMPT = `You are a code tutor helping developers understand a codebase.
You MUST follow these rules strictly:

1. ONLY answer based on the provided code context
2. ALWAYS cite specific files and line numbers for every claim
3. If you cannot find the answer in the provided context, say: "I couldn't find information about that in this repository."
4. Never make up or assume information not in the context
5. Be concise but thorough
6. Format code references as: \`file/path.ext:L10-L25\`
7. Use markdown formatting for readability

Remember: ZERO hallucination. Every statement must be grounded in the code context.`;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await authenticateRequest(request);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: repoId } = await params;
    if (!repoId) {
      return NextResponse.json({ error: "Repository ID is required" }, { status: 400 });
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const { question, sessionId } = body;
    if (!question || typeof question !== "string") {
      return NextResponse.json(
        { error: "Question is required and must be a string" },
        { status: 400 }
      );
    }

    // Verify repo access
    const [repo] = await db
      .select()
      .from(repositories)
      .where(
        and(
          eq(repositories.id, repoId),
          eq(repositories.userId, auth.userId)
        )
      );

    if (!repo) {
      return NextResponse.json(
        { error: "Repository not found" },
        { status: 404 }
      );
    }

    const indexedStates = ["INDEXED", "DOCS_GENERATED", "READY"];
    if (!indexedStates.includes(repo.status)) {
      return NextResponse.json(
        { error: "Repository must be indexed first" },
        { status: 400 }
      );
    }

    // Get user's API key
    const [user] = await db
      .select({ encryptedGeminiKey: users.encryptedGeminiKey })
      .from(users)
      .where(eq(users.id, auth.userId));

    if (!user?.encryptedGeminiKey) {
      return NextResponse.json(
        { error: "Gemini API key not configured" },
        { status: 400 }
      );
    }

    const apiKey = decrypt(user.encryptedGeminiKey);

    // Get or create session
    let session;
    if (sessionId) {
      const [existing] = await db
        .select()
        .from(tutorSessions)
        .where(eq(tutorSessions.id, sessionId));
      session = existing;
    }

    if (!session) {
      const [newSession] = await db
        .insert(tutorSessions)
        .values({
          repoId,
          userId: auth.userId,
          contextSummary: `Repository: ${repo.owner}/${repo.name} (${repo.primaryLanguage || "Multiple"})`,
        })
        .returning();
      session = newSession;
    }

    // Retrieve relevant code context
    const queryEmbedding = await generateLocalEmbedding(question);
    const searchResults = await searchSimilar(repoId, queryEmbedding, 8, 0.4, question);

    // Build code context
    const codeContext = searchResults
      .map(
        (r) =>
          `--- File: ${r.filePath} (lines ${r.startLine}-${r.endLine}) ---\n` +
          `Symbol: ${r.symbolName || "N/A"} (${r.symbolType || "code"})\n` +
          `\`\`\`${r.language || ""}\n${r.content}\n\`\`\``
      )
      .join("\n\n");

    // Get conversation history
    const history = await db
      .select()
      .from(tutorMessages)
      .where(eq(tutorMessages.sessionId, session.id))
      .orderBy(desc(tutorMessages.createdAt))
      .limit(6);

    history.reverse();

    let conversationContext = "";
    if (history.length > 0) {
      conversationContext =
        "Previous conversation:\n" +
        history
          .map((m: { role: string; content: string }) => `${m.role === "user" ? "Q" : "A"}: ${m.content.slice(0, 200)}`)
          .join("\n") +
        "\n\n";
    }

    // Build the full prompt
    const fullPrompt = `${conversationContext}Code Context:
${codeContext || "No relevant code found in the repository."}

Question: ${question}

Remember: Answer ONLY based on the code context above. Cite specific files and line numbers. If you cannot find the answer, say so explicitly.`;

    // Store user message
    await db.insert(tutorMessages).values({
      sessionId: session.id,
      role: "user",
      content: question,
    });

    // Update session activity
    await db
      .update(tutorSessions)
      .set({ lastActivityAt: new Date() })
      .where(eq(tutorSessions.id, session.id));

    // Stream the response
    const stream = await streamCompletion(
      fullPrompt,
      TUTOR_SYSTEM_PROMPT,
      apiKey,
      0.3
    );

    // Collect full response for storage while streaming
    let fullResponse = "";
    const sessionIdForStorage = session.id;

    const transformedStream = new TransformStream({
      transform(chunk, controller) {
        const text = new TextDecoder().decode(chunk);
        fullResponse += text;
        controller.enqueue(chunk);
      },
      async flush() {
        // Store assistant message after stream completes
        try {
          await db.insert(tutorMessages).values({
            sessionId: sessionIdForStorage,
            role: "assistant",
            content: fullResponse,
            referencesJson: JSON.stringify(
              searchResults.map((r) => ({
                file: r.filePath,
                lines: `${r.startLine}-${r.endLine}`,
                symbol: r.symbolName,
              }))
            ),
          });
        } catch (e) {
          console.error("Failed to store assistant message:", e);
        }
      },
    });

    const responseStream = stream.pipeThrough(transformedStream);

    return new Response(responseStream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "X-Session-Id": session.id,
        "Cache-Control": "no-cache",
      },
    });
  } catch (error) {
    console.error("Tutor error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
