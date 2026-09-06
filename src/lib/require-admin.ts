import "server-only";
import { cookies } from "next/headers";
import { SESSION_COOKIE, verifySessionToken } from "./auth";

/** True when the current request has a valid admin session. */
export async function isAdmin(): Promise<boolean> {
  const c = await cookies();
  return verifySessionToken(c.get(SESSION_COOKIE)?.value);
}
