export type DiffEntry = {
  path: string;
  type: "added" | "removed" | "changed";
  oldValue?: any;
  newValue?: any;
};

function isPlainObject(val: any): val is Record<string, any> {
  return typeof val === "object" && val !== null && !Array.isArray(val);
}

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
    } else if (isPlainObject(oldVal) && isPlainObject(newVal)) {
      // Recurse into nested objects
      diffs.push(...computeDiff(oldVal, newVal, fullPath));
    } else if (Array.isArray(oldVal) && Array.isArray(newVal)) {
      // Recurse into arrays element by element
      const maxLen = Math.max(oldVal.length, newVal.length);
      for (let i = 0; i < maxLen; i++) {
        const itemPath = `${fullPath}[${i}]`;
        if (i >= oldVal.length) {
          diffs.push({ path: itemPath, type: "added", newValue: newVal[i] });
        } else if (i >= newVal.length) {
          diffs.push({ path: itemPath, type: "removed", oldValue: oldVal[i] });
        } else if (isPlainObject(oldVal[i]) && isPlainObject(newVal[i])) {
          // Recurse into array items that are objects (e.g. resources)
          diffs.push(...computeDiff(oldVal[i], newVal[i], itemPath));
        } else if (JSON.stringify(oldVal[i]) !== JSON.stringify(newVal[i])) {
          diffs.push({
            path: itemPath,
            type: "changed",
            oldValue: oldVal[i],
            newValue: newVal[i],
          });
        }
      }
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
    return val.length > 200 ? val.slice(0, 200) + "..." : val;
  if (typeof val === "object") {
    const s = JSON.stringify(val, null, 2);
    return s.length > 300 ? s.slice(0, 300) + "..." : s;
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
