/**
 * Gitdocify — Code Chunking Engine
 *
 * Multi-language AST-aware chunking with sliding-window fallback.
 * Extracts logical code units (functions, classes) for semantic indexing.
 */

import path from "path";
import { detectLanguage, readFileSafe } from "./git";
import { estimateTokens } from "./llm";

/* ─────────────── Types ─────────────── */

export interface CodeChunkData {
  filePath: string; // relative to repo root
  startLine: number;
  endLine: number;
  content: string;
  language: string | null;
  symbolType: string | null;
  symbolName: string | null;
  tokenCount: number;
}

/* ─────────────── Python Symbol Extraction ─────────────── */

/**
 * Extract Python functions and classes as chunks via regex
 * (lightweight AST alternative).
 */
function extractPythonSymbols(
  content: string,
  filePath: string
): CodeChunkData[] {
  const lines = content.split("\n");
  const chunks: CodeChunkData[] = [];

  const classPattern = /^class\s+(\w+)/;
  const funcPattern = /^(?:async\s+)?def\s+(\w+)/;

  let currentSymbol: {
    type: string;
    name: string;
    start: number;
    indent: number;
  } | null = null;
  let currentLines: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const stripped = line.trimStart();
    const indent = line.length - stripped.length;
    const lineNum = i + 1;

    const classMatch = stripped.match(classPattern);
    const funcMatch = stripped.match(funcPattern);

    if (classMatch || funcMatch) {
      // Yield previous symbol
      if (currentSymbol && currentLines.length > 0) {
        const text = currentLines.join("\n");
        chunks.push({
          filePath,
          startLine: currentSymbol.start,
          endLine: lineNum - 1,
          content: text,
          language: "python",
          symbolType: currentSymbol.type,
          symbolName: currentSymbol.name,
          tokenCount: estimateTokens(text),
        });
      }

      currentSymbol = {
        type: classMatch ? "class" : "function",
        name: (classMatch?.[1] || funcMatch?.[1])!,
        start: lineNum,
        indent,
      };
      currentLines = [line];
    } else if (currentSymbol) {
      if (stripped === "" || indent > currentSymbol.indent) {
        currentLines.push(line);
      } else if (indent === currentSymbol.indent) {
        currentLines.push(line);
      } else {
        // Symbol ended
        const text = currentLines.join("\n");
        chunks.push({
          filePath,
          startLine: currentSymbol.start,
          endLine: lineNum - 1,
          content: text,
          language: "python",
          symbolType: currentSymbol.type,
          symbolName: currentSymbol.name,
          tokenCount: estimateTokens(text),
        });
        currentSymbol = null;
        currentLines = [];
      }
    }
  }

  // Yield final symbol
  if (currentSymbol && currentLines.length > 0) {
    const text = currentLines.join("\n");
    chunks.push({
      filePath,
      startLine: currentSymbol.start,
      endLine: lines.length,
      content: text,
      language: "python",
      symbolType: currentSymbol.type,
      symbolName: currentSymbol.name,
      tokenCount: estimateTokens(text),
    });
  }

  return chunks;
}

/* ─────────────── JS/TS Symbol Extraction ─────────────── */

/**
 * Extract JavaScript/TypeScript functions, classes, and exports via regex.
 */
function extractJsTsSymbols(
  content: string,
  filePath: string,
  language: string
): CodeChunkData[] {
  const lines = content.split("\n");
  const chunks: CodeChunkData[] = [];

  // Patterns for JS/TS functions, classes, and arrow functions
  const patterns = [
    { regex: /^(?:export\s+)?(?:default\s+)?class\s+(\w+)/, type: "class" },
    {
      regex:
        /^(?:export\s+)?(?:default\s+)?(?:async\s+)?function\s+(\w+)/,
      type: "function",
    },
    {
      regex:
        /^(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?\(/,
      type: "function",
    },
  ];

  let currentSymbol: {
    type: string;
    name: string;
    start: number;
    braceCount: number;
  } | null = null;
  let currentLines: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const stripped = line.trimStart();
    const lineNum = i + 1;

    if (!currentSymbol) {
      for (const { regex, type } of patterns) {
        const match = stripped.match(regex);
        if (match) {
          currentSymbol = {
            type,
            name: match[1],
            start: lineNum,
            braceCount: 0,
          };
          currentLines = [line];
          // Count braces on this line
          for (const ch of line) {
            if (ch === "{") currentSymbol.braceCount++;
            if (ch === "}") currentSymbol.braceCount--;
          }
          break;
        }
      }
    } else {
      currentLines.push(line);
      for (const ch of line) {
        if (ch === "{") currentSymbol.braceCount++;
        if (ch === "}") currentSymbol.braceCount--;
      }

      if (currentSymbol.braceCount <= 0 && currentLines.length > 1) {
        const text = currentLines.join("\n");
        chunks.push({
          filePath,
          startLine: currentSymbol.start,
          endLine: lineNum,
          content: text,
          language,
          symbolType: currentSymbol.type,
          symbolName: currentSymbol.name,
          tokenCount: estimateTokens(text),
        });
        currentSymbol = null;
        currentLines = [];
      }
    }
  }

  // Yield any remaining symbol
  if (currentSymbol && currentLines.length > 0) {
    const text = currentLines.join("\n");
    chunks.push({
      filePath,
      startLine: currentSymbol.start,
      endLine: lines.length,
      content: text,
      language,
      symbolType: currentSymbol.type,
      symbolName: currentSymbol.name,
      tokenCount: estimateTokens(text),
    });
  }

  return chunks;
}

/* ─────────────── Sliding Window Chunking ─────────────── */

/**
 * Generic sliding-window chunker for any language.
 */
function slidingWindowChunk(
  content: string,
  filePath: string,
  language: string | null,
  maxTokens: number = 1500,
  overlapTokens: number = 200
): CodeChunkData[] {
  const lines = content.split("\n");
  if (lines.length === 0) return [];

  const chunks: CodeChunkData[] = [];
  let currentLines: string[] = [];
  let currentStartLine = 1;
  let currentTokens = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineTokens = estimateTokens(line);

    if (currentTokens + lineTokens > maxTokens && currentLines.length > 0) {
      const text = currentLines.join("\n");
      chunks.push({
        filePath,
        startLine: currentStartLine,
        endLine: i,
        content: text,
        language,
        symbolType: null,
        symbolName: null,
        tokenCount: currentTokens,
      });

      // Overlap: keep last N tokens worth of lines
      const overlapLines: string[] = [];
      let overlapCount = 0;
      for (let j = currentLines.length - 1; j >= 0; j--) {
        const t = estimateTokens(currentLines[j]);
        if (overlapCount + t > overlapTokens) break;
        overlapLines.unshift(currentLines[j]);
        overlapCount += t;
      }

      currentLines = overlapLines;
      currentStartLine = i + 1 - overlapLines.length;
      currentTokens = overlapCount;
    }

    currentLines.push(line);
    currentTokens += lineTokens;
  }

  // Final chunk
  if (currentLines.length > 0) {
    const text = currentLines.join("\n");
    chunks.push({
      filePath,
      startLine: currentStartLine,
      endLine: lines.length,
      content: text,
      language,
      symbolType: null,
      symbolName: null,
      tokenCount: currentTokens,
    });
  }

  return chunks;
}

/* ─────────────── Main Chunking API ─────────────── */

/**
 * Chunk a single file into logical units.
 * Uses language-specific extractors when available, falls back to sliding window.
 */
export async function chunkFile(
  filePath: string,
  basePath: string
): Promise<CodeChunkData[]> {
  const content = await readFileSafe(filePath);
  if (!content || content.trim().length < 50) return [];

  const relativePath = path.relative(basePath, filePath).replace(/\\/g, "/");
  const language = detectLanguage(filePath);

  // Try language-specific extraction
  if (language === "python") {
    const symbols = extractPythonSymbols(content, relativePath);
    if (symbols.length > 0) return symbols;
  }

  if (language === "javascript" || language === "typescript") {
    const symbols = extractJsTsSymbols(content, relativePath, language);
    if (symbols.length > 0) return symbols;
  }

  // Fallback to sliding window
  return slidingWindowChunk(content, relativePath, language);
}

/**
 * Chunk an entire repository.
 */
export async function chunkRepository(
  repoPath: string,
  files: string[],
  maxChunks: number = 50000
): Promise<CodeChunkData[]> {
  const allChunks: CodeChunkData[] = [];

  for (const filePath of files) {
    if (allChunks.length >= maxChunks) break;

    const fileChunks = await chunkFile(filePath, repoPath);
    allChunks.push(...fileChunks);
  }

  return allChunks.slice(0, maxChunks);
}

/* ─────────────── File Tree Builder ─────────────── */

export interface FileNode {
  name: string;
  path: string;
  type: "file" | "directory";
  language?: string | null;
  size?: number;
  children?: FileNode[];
}

/**
 * Build a file tree from a list of file paths.
 */
export function buildFileTree(
  files: string[],
  basePath: string
): FileNode[] {
  const root: Map<string, FileNode> = new Map();

  for (const file of files) {
    const relativePath = path.relative(basePath, file).replace(/\\/g, "/");
    const parts = relativePath.split("/");

    let current = root;
    let currentPath = "";

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      currentPath = currentPath ? `${currentPath}/${part}` : part;
      const isFile = i === parts.length - 1;

      if (!current.has(part)) {
        const node: FileNode = {
          name: part,
          path: currentPath,
          type: isFile ? "file" : "directory",
          ...(isFile ? { language: detectLanguage(file) } : { children: [] }),
        };
        current.set(part, node);
      }

      if (!isFile) {
        const dirNode = current.get(part)!;
        if (!dirNode.children) dirNode.children = [];
        // Create a map for the next level
        const childMap = new Map<string, FileNode>();
        for (const child of dirNode.children) {
          childMap.set(child.name, child);
        }
        current = childMap;
        // After building, sync back
        dirNode.children = Array.from(childMap.values());
      }
    }
  }

  return Array.from(root.values());
}
