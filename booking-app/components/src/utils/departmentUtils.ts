/**
 * Normalize department name for comparison
 * @param dept - Department name to normalize
 * @param options - Normalization options
 * @returns Normalized department name
 */
export function normalizeDepartment(
  dept: string | undefined | null,
  options: {
    toLowerCase?: boolean;
    collapseSpaces?: boolean;
    removeSpaces?: boolean;
  } = {}
): string {
  const {
    toLowerCase = false,
    collapseSpaces = true,
    removeSpaces = false,
  } = options;

  if (!dept) return "";

  let normalized = dept.trim();

  if (removeSpaces) {
    // Remove all spaces
    normalized = normalized.replace(/\s+/g, "");
  } else if (collapseSpaces) {
    // Collapse multiple spaces into one
    normalized = normalized.replace(/\s+/g, " ");
  }

  if (toLowerCase) {
    normalized = normalized.toLowerCase();
  }

  return normalized;
}
