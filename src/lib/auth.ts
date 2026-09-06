import { SignJWT, jwtVerify } from "jose";

/**
 * Minimal admin session for a single-restaurant app.
 * A signed JWT (HS256) is stored in an httpOnly cookie. Works in both the
 * Edge middleware and Node server actions (jose is isomorphic).
 *
 * Env:
 *   ADMIN_PASSWORD — the login password for staff/owner
 *   AUTH_SECRET    — random secret used to sign the session
 */

export const SESSION_COOKIE = "gj_session";
const MAX_AGE = 60 * 60 * 24 * 7; // 7 days

function secret(): Uint8Array {
  const s = process.env.AUTH_SECRET || "dev-insecure-secret-change-me";
  return new TextEncoder().encode(s);
}

export async function createSessionToken(): Promise<string> {
  return new SignJWT({ role: "admin" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(secret());
}

export async function verifySessionToken(token: string | undefined | null): Promise<boolean> {
  if (!token) return false;
  try {
    const { payload } = await jwtVerify(token, secret());
    return payload.role === "admin";
  } catch {
    return false;
  }
}

export const SESSION_MAX_AGE = MAX_AGE;
