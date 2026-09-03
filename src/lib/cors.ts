import { NextResponse } from "next/server";

/**
 * CORS for the public reservation API so it can be called from another domain
 * (e.g. a WordPress site embedding the widget or using the REST endpoints).
 *
 * Configure allowed origins via env ALLOWED_ORIGINS (comma-separated).
 * Defaults to "*" for the demo. No cookies are used, so "*" is safe here.
 */
function allowOrigin(origin: string | null): string {
  const configured = (process.env.ALLOWED_ORIGINS || "*")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (configured.includes("*") || !origin) return "*";
  return configured.includes(origin) ? origin : configured[0] ?? "*";
}

export function corsHeaders(origin: string | null): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": allowOrigin(origin),
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

export function json(data: unknown, origin: string | null, status = 200) {
  return NextResponse.json(data, { status, headers: corsHeaders(origin) });
}

export function preflight(origin: string | null) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(origin) });
}
