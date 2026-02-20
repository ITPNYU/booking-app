/**
 * Extracts the form ID from a Google Form URL.
 * 
 * Google Form URLs can be in various formats:
 * - https://docs.google.com/forms/d/{FORM_ID}/viewform
 * - https://docs.google.com/forms/d/{FORM_ID}/edit
 * - https://docs.google.com/forms/d/{FORM_ID}/viewform?usp=sf_link
 * - Just the form ID itself
 * 
 * @param url - The Google Form URL or form ID
 * @returns The extracted form ID, or null if not found
 */
export function extractGoogleFormId(url: string | undefined | null): string | null {
  if (!url) return null;

  // If it's already just a form ID (no URL structure), return it
  if (!url.includes("http") && !url.includes("/")) {
    return url;
  }

  // Try to extract form ID from URL
  // Pattern: /forms/d/{FORM_ID}/
  const formIdMatch = url.match(/\/forms\/d\/([a-zA-Z0-9_-]+)/);
  if (formIdMatch && formIdMatch[1]) {
    return formIdMatch[1];
  }

  // If no match found, return null
  return null;
}

