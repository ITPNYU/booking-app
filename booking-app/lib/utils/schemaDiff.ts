export type DiffSummary = {
  added: string[];
  removed: string[];
  changed: string[];
  unchanged: string[];
};

/**
 * Compare two schema objects at the top-level key level.
 * Returns lists of added, removed, changed, and unchanged keys.
 */
export function computeDiffSummary(
  source: Record<string, unknown>,
  target: Record<string, unknown> | null,
): DiffSummary {
  if (!target) {
    return {
      added: Object.keys(source),
      removed: [],
      changed: [],
      unchanged: [],
    };
  }
  const allKeys = new Set([...Object.keys(source), ...Object.keys(target)]);
  const added: string[] = [];
  const removed: string[] = [];
  const changed: string[] = [];
  const unchanged: string[] = [];

  for (const key of allKeys) {
    const inSource = key in source;
    const inTarget = key in target;
    if (inSource && !inTarget) {
      added.push(key);
    } else if (!inSource && inTarget) {
      removed.push(key);
    } else if (JSON.stringify(source[key]) !== JSON.stringify(target[key])) {
      changed.push(key);
    } else {
      unchanged.push(key);
    }
  }
  return { added, removed, changed, unchanged };
}
