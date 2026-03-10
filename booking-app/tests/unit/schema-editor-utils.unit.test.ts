import { describe, expect, it } from "vitest";
import {
  computeDiff,
  formatValue,
  setNestedValue,
} from "@/components/src/client/routes/super/schemaEditorUtils";

describe("setNestedValue", () => {
  it("sets a top-level key", () => {
    const result = setNestedValue({ a: 1 }, "a", 2);
    expect(result).toEqual({ a: 2 });
  });

  it("sets a nested key", () => {
    const result = setNestedValue({ a: { b: 1 } }, "a.b", 2);
    expect(result).toEqual({ a: { b: 2 } });
  });

  it("sets a deeply nested key", () => {
    const result = setNestedValue(
      { a: { b: { c: 1 } } },
      "a.b.c",
      "new",
    );
    expect(result).toEqual({ a: { b: { c: "new" } } });
  });

  it("creates intermediate objects if missing", () => {
    const result = setNestedValue({}, "a.b.c", 42);
    expect(result).toEqual({ a: { b: { c: 42 } } });
  });

  it("preserves other keys at each level", () => {
    const result = setNestedValue(
      { a: { b: 1, x: 2 }, y: 3 },
      "a.b",
      10,
    );
    expect(result).toEqual({ a: { b: 10, x: 2 }, y: 3 });
  });

  it("does not mutate the original object", () => {
    const original = { a: { b: 1 } };
    const result = setNestedValue(original, "a.b", 2);
    expect(original.a.b).toBe(1);
    expect(result.a.b).toBe(2);
  });
});

describe("computeDiff", () => {
  it("returns empty array for identical objects", () => {
    const obj = { name: "test", count: 5 };
    expect(computeDiff(obj, obj)).toEqual([]);
  });

  it("detects added keys", () => {
    const diffs = computeDiff({ a: 1 }, { a: 1, b: 2 });
    expect(diffs).toEqual([
      { path: "b", type: "added", newValue: 2 },
    ]);
  });

  it("detects removed keys", () => {
    const diffs = computeDiff({ a: 1, b: 2 }, { a: 1 });
    expect(diffs).toEqual([
      { path: "b", type: "removed", oldValue: 2 },
    ]);
  });

  it("detects changed primitive values", () => {
    const diffs = computeDiff({ a: 1 }, { a: 2 });
    expect(diffs).toEqual([
      { path: "a", type: "changed", oldValue: 1, newValue: 2 },
    ]);
  });

  it("detects changed string values", () => {
    const diffs = computeDiff({ name: "old" }, { name: "new" });
    expect(diffs).toEqual([
      { path: "name", type: "changed", oldValue: "old", newValue: "new" },
    ]);
  });

  it("detects changed boolean values", () => {
    const diffs = computeDiff(
      { showEquipment: true },
      { showEquipment: false },
    );
    expect(diffs).toEqual([
      {
        path: "showEquipment",
        type: "changed",
        oldValue: true,
        newValue: false,
      },
    ]);
  });

  it("recurses into nested objects", () => {
    const old = { config: { startHour: "09:00", slotUnit: 15 } };
    const updated = { config: { startHour: "08:00", slotUnit: 15 } };
    const diffs = computeDiff(old, updated);
    expect(diffs).toEqual([
      {
        path: "config.startHour",
        type: "changed",
        oldValue: "09:00",
        newValue: "08:00",
      },
    ]);
  });

  it("recurses into arrays of objects element by element", () => {
    const old = {
      resources: [
        { name: "Room A", capacity: 10 },
        { name: "Room B", capacity: 20 },
      ],
    };
    const updated = {
      resources: [
        { name: "Room A", capacity: 15 },
        { name: "Room B", capacity: 20 },
      ],
    };
    const diffs = computeDiff(old, updated);
    expect(diffs).toEqual([
      {
        path: "resources[0].capacity",
        type: "changed",
        oldValue: 10,
        newValue: 15,
      },
    ]);
  });

  it("detects added array elements", () => {
    const old = { items: [{ name: "a" }] };
    const updated = { items: [{ name: "a" }, { name: "b" }] };
    const diffs = computeDiff(old, updated);
    expect(diffs).toEqual([
      { path: "items[1]", type: "added", newValue: { name: "b" } },
    ]);
  });

  it("detects removed array elements", () => {
    const old = { items: [{ name: "a" }, { name: "b" }] };
    const updated = { items: [{ name: "a" }] };
    const diffs = computeDiff(old, updated);
    expect(diffs).toEqual([
      { path: "items[1]", type: "removed", oldValue: { name: "b" } },
    ]);
  });

  it("detects changed primitive array elements", () => {
    const diffs = computeDiff(
      { services: ["a", "b"] },
      { services: ["a", "c"] },
    );
    expect(diffs).toEqual([
      {
        path: "services[1]",
        type: "changed",
        oldValue: "b",
        newValue: "c",
      },
    ]);
  });

  it("recurses into deeply nested array objects", () => {
    const old = {
      resources: [
        { name: "Room", autoApproval: { minHour: { admin: 8 } } },
      ],
    };
    const updated = {
      resources: [
        { name: "Room", autoApproval: { minHour: { admin: 10 } } },
      ],
    };
    const diffs = computeDiff(old, updated);
    expect(diffs).toEqual([
      {
        path: "resources[0].autoApproval.minHour.admin",
        type: "changed",
        oldValue: 8,
        newValue: 10,
      },
    ]);
  });

  it("handles null values", () => {
    const diffs = computeDiff({ a: null }, { a: "value" });
    expect(diffs).toEqual([
      { path: "a", type: "changed", oldValue: null, newValue: "value" },
    ]);
  });

  it("handles multiple changes across nested structure", () => {
    const old = {
      name: "MC",
      showVIP: true,
      emailMessages: { declined: "old msg", canceled: "same" },
    };
    const updated = {
      name: "Media Commons",
      showVIP: true,
      emailMessages: { declined: "new msg", canceled: "same" },
      newField: 42,
    };
    const diffs = computeDiff(old, updated);
    expect(diffs).toHaveLength(3);
    expect(diffs).toContainEqual({
      path: "name",
      type: "changed",
      oldValue: "MC",
      newValue: "Media Commons",
    });
    expect(diffs).toContainEqual({
      path: "emailMessages.declined",
      type: "changed",
      oldValue: "old msg",
      newValue: "new msg",
    });
    expect(diffs).toContainEqual({
      path: "newField",
      type: "added",
      newValue: 42,
    });
  });

  it("handles empty objects", () => {
    expect(computeDiff({}, {})).toEqual([]);
  });

  it("handles both null/undefined inputs", () => {
    const diffs = computeDiff(null, { a: 1 });
    expect(diffs).toEqual([
      { path: "a", type: "added", newValue: 1 },
    ]);
  });
});

describe("formatValue", () => {
  it("formats undefined", () => {
    expect(formatValue(undefined)).toBe("(undefined)");
  });

  it("formats null", () => {
    expect(formatValue(null)).toBe("(null)");
  });

  it("formats short strings as-is", () => {
    expect(formatValue("hello")).toBe("hello");
  });

  it("truncates long strings at 200 chars", () => {
    const longStr = "a".repeat(250);
    const result = formatValue(longStr);
    expect(result.length).toBe(203); // 200 + "..."
    expect(result.endsWith("...")).toBe(true);
  });

  it("keeps strings under 200 chars as-is", () => {
    const str = "a".repeat(200);
    expect(formatValue(str)).toBe(str);
  });

  it("formats numbers", () => {
    expect(formatValue(42)).toBe("42");
  });

  it("formats booleans", () => {
    expect(formatValue(true)).toBe("true");
  });

  it("formats short objects as pretty JSON", () => {
    const result = formatValue({ a: 1 });
    expect(result).toContain('"a": 1');
  });

  it("truncates long objects at 300 chars", () => {
    const bigObj = { key: "a".repeat(300) };
    const result = formatValue(bigObj);
    expect(result.length).toBe(303); // 300 + "..."
    expect(result.endsWith("...")).toBe(true);
  });

  it("formats arrays as pretty JSON", () => {
    const result = formatValue([1, 2, 3]);
    expect(result).toContain("1");
    expect(result).toContain("2");
    expect(result).toContain("3");
  });
});
