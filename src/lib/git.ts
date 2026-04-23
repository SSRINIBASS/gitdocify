/**
 * Gitdocify — Git Operations
 *
 * Handles GitHub URL parsing, repository cloning, and safe file traversal.
 */

import simpleGit from "simple-git";
import path from "path";
import fs from "fs/promises";
import { existsSync } from "fs";

const STORAGE_PATH = process.env.STORAGE_PATH || "./data";

export interface RepoInfo {
  url: string;
  owner: string;
  name: string;
}

/**
 * Parse a GitHub URL into owner and name.
 * Supports: https://github.com/owner/repo, github.com/owner/repo, etc.
 */
export function parseGithubUrl(url: string): RepoInfo {
  // Normalize URL
  let normalized = url.trim();
  if (!normalized.startsWith("http")) {
    normalized = `https://${normalized}`;
  }
  normalized = normalized.replace(/\.git$/, "").replace(/\/$/, "");

  const urlObj = new URL(normalized);
  const parts = urlObj.pathname.split("/").filter(Boolean);

  if (parts.length < 2) {
    throw new Error(`Invalid GitHub URL: ${url}`);
  }

  const owner = parts[0];
  const name = parts[1];

  return {
    url: `https://github.com/${owner}/${name}`,
    owner,
    name,
  };
}

/**
 * Clone a repository to the local storage path.
 * Uses shallow clone (depth 1) for speed.
 * Returns the clone path and latest commit hash.
 */
export async function cloneRepository(
  repoUrl: string,
  repoId: string
): Promise<{ clonePath: string; commitHash: string }> {
  const reposDir = path.join(STORAGE_PATH, "repos");
  await fs.mkdir(reposDir, { recursive: true });

  const clonePath = path.join(reposDir, repoId);

  // Clean up if exists
  if (existsSync(clonePath)) {
    await fs.rm(clonePath, { recursive: true, force: true });
  }

  const git = simpleGit();
  await git.clone(repoUrl, clonePath, ["--depth", "1"]);

  // Get commit hash
  const repoGit = simpleGit(clonePath);
  const log = await repoGit.log({ maxCount: 1 });
  const commitHash = log.latest?.hash || "unknown";

  return { clonePath, commitHash };
}

/* ─────────────── Safe File Traversal ─────────────── */

const SKIP_DIRS = new Set([
  ".git",
  "node_modules",
  "__pycache__",
  ".venv",
  "venv",
  ".pytest_cache",
  ".next",
  ".nuxt",
  "dist",
  "build",
  ".tox",
  ".mypy_cache",
  ".ruff_cache",
  "coverage",
  ".nyc_output",
  ".DS_Store",
]);

const SKIP_EXTENSIONS = new Set([
  ".pyc", ".pyo", ".so", ".dll", ".exe", ".bin",
  ".lock", ".whl", ".tar", ".gz", ".zip", ".rar",
  ".png", ".jpg", ".jpeg", ".gif", ".ico", ".svg",
  ".pdf", ".woff", ".woff2", ".ttf", ".eot",
  ".mp3", ".mp4", ".avi", ".mov", ".map",
  ".min.js", ".min.css",
]);

/**
 * Recursively get all code files in a directory, skipping irrelevant dirs/files.
 */
export async function getFilesSafely(dirPath: string): Promise<string[]> {
  const files: string[] = [];

  async function walk(currentPath: string) {
    let entries;
    try {
      entries = await fs.readdir(currentPath, { withFileTypes: true });
    } catch {
      return; // Permission error or other issue
    }

    for (const entry of entries) {
      if (SKIP_DIRS.has(entry.name)) continue;

      const fullPath = path.join(currentPath, entry.name);

      if (entry.isDirectory()) {
        await walk(fullPath);
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (SKIP_EXTENSIONS.has(ext)) continue;

        // Skip very large files (> 2MB)
        try {
          const stat = await fs.stat(fullPath);
          if (stat.size > 2 * 1024 * 1024) continue;
          if (stat.size < 10) continue; // Skip nearly empty files
        } catch {
          continue;
        }

        files.push(fullPath);
      }
    }
  }

  await walk(dirPath);
  return files;
}

/**
 * Read a file safely, handling encoding issues.
 */
export async function readFileSafe(filePath: string): Promise<string | null> {
  try {
    return await fs.readFile(filePath, "utf-8");
  } catch {
    try {
      return await fs.readFile(filePath, "latin1");
    } catch {
      return null;
    }
  }
}

/* ─────────────── Language Detection ─────────────── */

const LANGUAGE_MAP: Record<string, string> = {
  ".py": "python",
  ".js": "javascript",
  ".ts": "typescript",
  ".jsx": "javascript",
  ".tsx": "typescript",
  ".go": "go",
  ".rs": "rust",
  ".java": "java",
  ".rb": "ruby",
  ".php": "php",
  ".c": "c",
  ".cpp": "cpp",
  ".h": "c",
  ".hpp": "cpp",
  ".cs": "csharp",
  ".swift": "swift",
  ".kt": "kotlin",
  ".scala": "scala",
  ".sql": "sql",
  ".sh": "bash",
  ".yaml": "yaml",
  ".yml": "yaml",
  ".json": "json",
  ".xml": "xml",
  ".html": "html",
  ".css": "css",
  ".md": "markdown",
  ".txt": "text",
  ".r": "r",
  ".R": "r",
};

export function detectLanguage(filePath: string): string | null {
  const ext = path.extname(filePath).toLowerCase();
  return LANGUAGE_MAP[ext] || null;
}
