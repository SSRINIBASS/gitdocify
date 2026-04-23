/**
 * Gitdocify — Auth Utilities (JWT + Password Hashing)
 *
 * Uses `jose` for JWT (Edge-compatible) and `bcryptjs` for password hashing.
 */

import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import bcrypt from "bcryptjs";

const SALT_ROUNDS = 12;

function getJwtSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET is required");
  return new TextEncoder().encode(secret);
}

export interface TokenPayload extends JWTPayload {
  userId: string;
  email: string;
}

/**
 * Sign a JWT token with user claims. Expires in 24 hours.
 */
export async function signToken(payload: {
  userId: string;
  email: string;
}): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("24h")
    .sign(getJwtSecret());
}

/**
 * Verify and decode a JWT token.
 */
export async function verifyToken(token: string): Promise<TokenPayload> {
  const { payload } = await jwtVerify(token, getJwtSecret());
  return payload as TokenPayload;
}

/**
 * Hash a plaintext password.
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

/**
 * Compare a plaintext password to a hash.
 */
export async function comparePassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Extract token from Authorization header or cookie.
 */
export function extractToken(request: Request): string | null {
  // Check Authorization header
  const authHeader = request.headers.get("Authorization");
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.slice(7);
  }

  // Check cookie
  const cookieHeader = request.headers.get("Cookie");
  if (cookieHeader) {
    const match = cookieHeader.match(/token=([^;]+)/);
    if (match) return match[1];
  }

  return null;
}

/**
 * Authenticate a request. Returns the token payload or null.
 */
export async function authenticateRequest(
  request: Request
): Promise<TokenPayload | null> {
  const token = extractToken(request);
  if (!token) return null;

  try {
    return await verifyToken(token);
  } catch {
    return null;
  }
}
