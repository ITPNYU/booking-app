export type DiffEntry = {
  path: string;
  type: "added" | "removed" | "changed";
  oldValue?: any;
  newValue?: any;
};

export function computeDiff(
  oldObj: any,
  newObj: any,
  path = "",
): DiffEntry[] {
  const diffs: DiffEntry[] = [];

  const allKeys = new Set([
    ...Object.keys(oldObj ?? {}),
    ...Object.keys(newObj ?? {}),
  ]);

  for (const key of allKeys) {
    const fullPath = path ? `${path}.${key}` : key;
    const oldVal = oldObj?.[key];
    const newVal = newObj?.[key];

    if (oldVal === undefined && newVal !== undefined) {
      diffs.push({ path: fullPath, type: "added", newValue: newVal });
    } else if (oldVal !== undefined && newVal === undefined) {
      diffs.push({ path: fullPath, type: "removed", oldValue: oldVal });
    } else if (
      typeof oldVal === "object" &&
      oldVal !== null &&
      typeof newVal === "object" &&
      newVal !== null &&
      !Array.isArray(oldVal) &&
      !Array.isArray(newVal)
    ) {
      diffs.push(...computeDiff(oldVal, newVal, fullPath));
    } else if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
      diffs.push({
        path: fullPath,
        type: "changed",
        oldValue: oldVal,
        newValue: newVal,
      });
    }
  }

  return diffs;
}

export function formatValue(val: any): string {
  if (val === undefined) return "(undefined)";
  if (val === null) return "(null)";
  if (typeof val === "string")
    return val.length > 80 ? val.slice(0, 80) + "..." : val;
  if (typeof val === "object") {
    const s = JSON.stringify(val);
    return s.length > 80 ? s.slice(0, 80) + "..." : s;
  }
  return String(val);
}

export function setNestedValue(obj: any, path: string, value: any): any {
  const keys = path.split(".");
  if (keys.length === 1) {
    return { ...obj, [keys[0]]: value };
  }
  const [head, ...rest] = keys;
  return {
    ...obj,
    [head]: setNestedValue(obj[head] ?? {}, rest.join("."), value),
  };
}
