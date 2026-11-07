import { ITP_DEPT_NAME_KEYWORDS, ITP_GROUP_SHORT_NAMES } from "./tenantUtils";

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
  } = {},
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

/**
 * True when a saved department label (booking or approver record) belongs to
 * the ITP / IMA / Low Res group. Short names use exact equality to avoid
 * substring false-positives (e.g. "ima" inside "imaging sciences").
 */
export function isItpGroupDepartment(dept: string | undefined | null): boolean {
  const normalized = normalizeDepartment(dept, { toLowerCase: true });
  if (!normalized) return false;
  return (
    ITP_GROUP_SHORT_NAMES.includes(normalized) ||
    ITP_DEPT_NAME_KEYWORDS.some((keyword) => normalized.includes(keyword))
  );
}

/**
 * Whether two saved department labels refer to the same department.
 * ITP, IMA and Low Res labels all match each other.
 */
export function departmentsMatch(
  a: string | undefined | null,
  b: string | undefined | null,
): boolean {
  const normalizedA = normalizeDepartment(a, {
    toLowerCase: true,
    removeSpaces: true,
  });
  const normalizedB = normalizeDepartment(b, {
    toLowerCase: true,
    removeSpaces: true,
  });
  if (!normalizedA || !normalizedB) return false;
  return (
    normalizedA === normalizedB ||
    (isItpGroupDepartment(a) && isItpGroupDepartment(b))
  );
}
