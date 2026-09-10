/**
 * Branding helpers (dependency-free so they're safe to import anywhere).
 *
 * The bundled Villa Gjeçaj logo ships in public/ and is the default until an
 * administrator uploads one. Once RestaurantSetting.logoUrl is set (an upload),
 * that takes priority.
 */
export const BUNDLED_LOGO_PATH = "/branding/villa-gjecaj-logo.png";

/** Absolute logo URL for emails: the uploaded logo if set, else the bundled default. */
export function resolveLogoUrl(logoUrl: string | null | undefined, appBaseUrl: string): string {
  if (logoUrl && logoUrl.trim()) return logoUrl;
  return `${appBaseUrl.replace(/\/$/, "")}${BUNDLED_LOGO_PATH}`;
}
