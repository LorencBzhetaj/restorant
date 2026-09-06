"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, SESSION_MAX_AGE, createSessionToken, verifySessionToken } from "@/lib/auth";

export type LoginResult = { ok: true } | { ok: false; error: string };

export async function login(password: string): Promise<LoginResult> {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) return { ok: false, error: "Admin password is not configured (set ADMIN_PASSWORD)." };
  if (!password || password !== expected) return { ok: false, error: "Wrong password." };

  const token = await createSessionToken();
  const c = await cookies();
  c.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
  return { ok: true };
}

export async function logout() {
  const c = await cookies();
  c.delete(SESSION_COOKIE);
  redirect("/login");
}

/** Guard for admin server actions — throws if there is no valid session. */
export async function requireAdmin(): Promise<void> {
  const c = await cookies();
  const ok = await verifySessionToken(c.get(SESSION_COOKIE)?.value);
  if (!ok) throw new Error("UNAUTHORIZED");
}
