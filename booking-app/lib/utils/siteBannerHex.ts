/** Must stay aligned with the site-banner write route (`/api/tenant-site-banner`). */
export const SITE_BANNER_MESSAGE_MAX_LEN = 4000;

/**
 * Accepts `#RGB` or `#RRGGBB` (case-insensitive). Returns lowercase `#rrggbb` or null.
 */
export function normalizeSiteBannerColorHex(input: string): string | null {
  const s = input.trim();
  const long = /^#[0-9a-f]{6}$/i;
  if (long.test(s)) {
    return s.toLowerCase();
  }
  const short = /^#([0-9a-f]{3})$/i.exec(s);
  if (short) {
    const [, rgb] = short;
    const [r, g, b] = rgb.split("");
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }
  return null;
}

/**
 * Same as MUI `deepPurple.A700` (`palette.primary.main` in `app/theme/theme.ts`).
 * Hardcoded so server routes do not import `@mui/material/colors`.
 */
export const DEFAULT_SITE_BANNER_COLOR_HEX = "#6200ea";

export function parseStoredSiteBannerColorHex(value: unknown): string {
  if (typeof value !== "string") {
    return DEFAULT_SITE_BANNER_COLOR_HEX;
  }
  return normalizeSiteBannerColorHex(value) ?? DEFAULT_SITE_BANNER_COLOR_HEX;
}
