/**
 * Gitdocify — Vector Search (pgvector)
 *
 * All vector operations happen inside PostgreSQL via pgvector.
 * No external vector store files needed.
 */

import { rawQuery, isPostgres } from "@/db";

export interface SearchResult {
  id: string;
  repoId: string;
  filePath: string;
  startLine: number;
  endLine: number;
  symbolType: string | null;
  symbolName: string | null;
  language: string | null;
  content: string;
  tokenCount: number | null;
  score: number;
}

/**
 * Search for similar code chunks.
 * Uses pgvector on PostgreSQL, and basic keyword search on SQLite.
 */
export async function searchSimilar(
  repoId: string,
  embedding: number[],
  topK: number = 10,
  threshold: number = 0.65,
  query?: string // Optional query text for SQLite fallback
): Promise<SearchResult[]> {
  if (isPostgres) {
    const vectorStr = `[${embedding.join(",")}]`;
    return await rawQuery<SearchResult>(
      `
      SELECT
        id,
        repo_id AS "repoId",
        file_path AS "filePath",
        start_line AS "startLine",
        end_line AS "endLine",
        symbol_type AS "symbolType",
        symbol_name AS "symbolName",
        language,
        content,
        token_count AS "tokenCount",
        1 - (embedding <=> $1::vector) AS score
      FROM code_chunks
      WHERE repo_id = $2
        AND embedding IS NOT NULL
        AND 1 - (embedding <=> $1::vector) >= $3
      ORDER BY embedding <=> $1::vector
      LIMIT $4
      `,
      [vectorStr, repoId, threshold, topK]
    );
  } else {
    // SQLite Fallback: Basic keyword search if query is provided, otherwise return empty
    if (!query) {
      console.warn("⚠️ [search] SQLite mode requires text query for fallback search.");
      return [];
    }

    // Split query into keywords
    const keywords = query.split(/\s+/).filter(k => k.length > 2);
    if (keywords.length === 0) return [];

    const likeClauses = keywords.map(() => "content LIKE ?").join(" OR ");
    const params = [repoId, ...keywords.map(k => `%${k}%`), topK];

    const results = await rawQuery<SearchResult>(
      `
      SELECT
        id,
        repo_id AS "repoId",
        file_path AS "filePath",
        start_line AS "startLine",
        end_line AS "endLine",
        symbol_type AS "symbolType",
        symbol_name AS "symbolName",
        language,
        content,
        token_count AS "tokenCount",
        1.0 AS score -- Mock score for SQLite
      FROM code_chunks
      WHERE repo_id = ?
        AND (${likeClauses})
      LIMIT ?
      `,
      params
    );

    return results;
  }
}

/**
 * Store embeddings for a batch of chunks.
 * Only works on PostgreSQL.
 */
export async function storeEmbeddings(
  chunkIds: string[],
  embeddings: number[][]
): Promise<void> {
  if (!isPostgres) {
    console.log("ℹ️ [index] SQLite mode: Skipping embedding storage (no vector column).");
    return;
  }

  if (chunkIds.length === 0) return;

  // Batch update using a CTE for performance
  const values = chunkIds
    .map((id, i) => `('${id}'::uuid, '[${embeddings[i].join(",")}]'::vector)`)
    .join(",\n");

  await rawQuery(
    `
    UPDATE code_chunks AS c
    SET embedding = v.embedding
    FROM (VALUES ${values}) AS v(id, embedding)
    WHERE c.id = v.id
    `
  );
}
