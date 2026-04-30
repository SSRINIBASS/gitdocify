/**
 * Gitdocify — Input Validation Utilities
 *
 * Security utilities for validating user input.
 */

/**
 * Validate and sanitize user input to prevent injection attacks
 */
export function sanitizeInput(input: string): string {
  if (typeof input !== 'string') {
    return '';
  }

  // Remove potentially dangerous characters
  return input
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;")
    .replace(/\//g, "&#x2F;");
}

/**
 * Validate email format
 */
export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate URL format
 */
export function validateUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Validate GitHub repository URL
 */
export function validateGithubUrl(url: string): boolean {
  if (!validateUrl(url)) {
    return false;
  }

  try {
    const parsedUrl = new URL(url);
    return parsedUrl.hostname === 'github.com' ||
           parsedUrl.hostname === 'www.github.com';
  } catch {
    return false;
  }
}

/**
 * Validate repository ID format (UUID)
 */
export function validateRepoId(repoId: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(repoId);
}

/**
 * Validate search query
 */
export function validateSearchQuery(query: string): { valid: boolean; message: string } {
  if (!query || query.trim().length < 2) {
    return { valid: false, message: "Search query must be at least 2 characters" };
  }

  if (query.trim().length > 1000) {
    return { valid: false, message: "Search query is too long (max 1000 characters)" };
  }

  return { valid: true, message: "Valid query" };
}