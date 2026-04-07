export type DiffDetail = {
  key: string;
  sourceValue?: unknown;
  targetValue?: unknown;
};

export type DiffSummary = {
  added: DiffDetail[];
  removed: DiffDetail[];
  changed: DiffDetail[];
  unchangedCount: number;
};

/**
 * Compare two schema objects at the top-level key level.
 * Returns lists of added, removed, and changed keys with their values.
 */
export function computeDiffSummary(
  source: Record<string, unknown>,
  target: Record<string, unknown> | null,
): DiffSummary {
  if (!target) {
    return {
      added: Object.keys(source).map((key) => ({
        key,
        sourceValue: source[key],
      })),
      removed: [],
      changed: [],
      unchangedCount: 0,
    };
  }
  const allKeys = new Set([...Object.keys(source), ...Object.keys(target)]);
  const added: DiffDetail[] = [];
  const removed: DiffDetail[] = [];
  const changed: DiffDetail[] = [];
  let unchangedCount = 0;

  for (const key of allKeys) {
    const inSource = key in source;
    const inTarget = key in target;
    if (inSource && !inTarget) {
      added.push({ key, sourceValue: source[key] });
    } else if (!inSource && inTarget) {
      removed.push({ key, targetValue: target[key] });
    } else if (JSON.stringify(source[key]) !== JSON.stringify(target[key])) {
      changed.push({
        key,
        sourceValue: source[key],
        targetValue: target[key],
      });
    } else {
      unchangedCount++;
    }
  }
  return { added, removed, changed, unchangedCount };
}
