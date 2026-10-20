import { describe, expect, it } from "vitest";
import { computeDiff } from "@/lib/utils/schemaDiff";
import {
  getSlice,
  isDirtyUnder,
  pathPrefix,
  resourceLabelForPath,
  resourceLabels,
  sectionKeys,
  setSlice,
  sortKeysDeep,
} from "@/components/src/client/routes/super/schemaEditorNav";

const schema = {
  name: "MC",
  calendarConfig: { startHour: { student: "09:00:00" } },
  resources: [
    { name: "Room 103", resourceId: "12", isEquipment: false },
    { name: "Annex A", resourceId: "13", isEquipment: false, parentResourceId: "12" },
  ],
};

describe("pathPrefix / isDirtyUnder", () => {
  it("maps selections to diff path prefixes", () => {
    expect(pathPrefix({ kind: "all" })).toBe("");
    expect(pathPrefix({ kind: "section", key: "calendarConfig" })).toBe("calendarConfig");
    expect(pathPrefix({ kind: "resource", index: 1 })).toBe("resources[1]");
  });

  it("marks only the slice that contains a change", () => {
    const edited = {
      ...schema,
      resources: [
        schema.resources[0],
        { ...schema.resources[1], name: "Annex B" },
      ],
    };
    const diffs = computeDiff(schema, edited);
    expect(isDirtyUnder(diffs, "")).toBe(true);
    expect(isDirtyUnder(diffs, "resources")).toBe(true);
    expect(isDirtyUnder(diffs, "resources[1]")).toBe(true);
    expect(isDirtyUnder(diffs, "resources[0]")).toBe(false);
    expect(isDirtyUnder(diffs, "calendarConfig")).toBe(false);
    expect(isDirtyUnder(diffs, "name")).toBe(false);
  });

  it("does not confuse a key with a longer key sharing its prefix", () => {
    const diffs = computeDiff({ name: "a", nameForPolicy: "x" }, { name: "a", nameForPolicy: "y" });
    expect(isDirtyUnder(diffs, "name")).toBe(false);
    expect(isDirtyUnder(diffs, "nameForPolicy")).toBe(true);
  });
});

describe("getSlice / setSlice", () => {
  it("reads the whole document, a section, or one resource", () => {
    expect(getSlice(schema, { kind: "all" })).toBe(schema);
    expect(getSlice(schema, { kind: "section", key: "name" })).toBe("MC");
    expect(getSlice(schema, { kind: "resource", index: 1 })).toBe(schema.resources[1]);
  });

  it("falls back to the code default for an unconfigured section", () => {
    const fallback = { policy: "<p>default</p>" };
    expect(getSlice(schema, { kind: "section", key: "policy" }, fallback)).toBe("<p>default</p>");
  });

  it("writes a section without mutating the input", () => {
    const next = setSlice(schema, { kind: "section", key: "name" }, "MC2");
    expect(next.name).toBe("MC2");
    expect(schema.name).toBe("MC");
    expect(next.resources).toBe(schema.resources);
  });

  it("writes one resource and keeps the others by reference", () => {
    const next = setSlice(schema, { kind: "resource", index: 0 }, { name: "Room 104" });
    expect((next.resources as unknown[])[0]).toEqual({ name: "Room 104" });
    expect((next.resources as unknown[])[1]).toBe(schema.resources[1]);
    expect(schema.resources[0].name).toBe("Room 103");
  });

  it("keeps an unconfigured key absent when the written value equals the default", () => {
    const fallback = { policy: "<p>default</p>" };
    const added = setSlice(schema, { kind: "section", key: "policy" }, "<p>custom</p>", {
      original: schema,
      fallback,
    });
    expect(added.policy).toBe("<p>custom</p>");

    const reverted = setSlice(added, { kind: "section", key: "policy" }, "<p>default</p>", {
      original: schema,
      fallback,
    });
    expect("policy" in reverted).toBe(false);
  });

  it("replaces the whole document for the raw view", () => {
    const next = setSlice(schema, { kind: "all" }, { name: "only" });
    expect(next).toEqual({ name: "only" });
  });
});

describe("resourceLabels / resourceLabelForPath", () => {
  it("labels resources with name, id, equipment and annex info", () => {
    expect(resourceLabels(schema)).toEqual([
      { index: 0, name: "Room 103", resourceId: "12", isEquipment: false, parentResourceId: undefined },
      { index: 1, name: "Annex A", resourceId: "13", isEquipment: false, parentResourceId: "12" },
    ]);
  });

  it("falls back to the index when a resource has no name", () => {
    expect(resourceLabels({ resources: [{ resourceId: 5 }] })[0]).toMatchObject({
      name: "#0",
      resourceId: "5",
    });
  });

  it("resolves a resources[i] diff path to the resource name", () => {
    expect(resourceLabelForPath("resources[1].name", schema, schema)).toBe(
      "Annex A (resourceId 13)",
    );
    expect(resourceLabelForPath("calendarConfig.startHour", schema, schema)).toBeUndefined();
  });

  it("looks up a removed resource on the before side", () => {
    const after = { ...schema, resources: [schema.resources[0]] };
    expect(resourceLabelForPath("resources[1]", schema, after)).toBe("Annex A (resourceId 13)");
  });
});

describe("sectionKeys", () => {
  it("lists keys alphabetically and flags which ones are stored", () => {
    const defaults = { name: "", policy: "", resources: [] };
    expect(sectionKeys(schema, defaults)).toEqual([
      { key: "calendarConfig", present: true },
      { key: "name", present: true },
      { key: "policy", present: false },
      { key: "resources", present: true },
    ]);
  });
});

describe("sortKeysDeep", () => {
  it("sorts object keys at every level and keeps array order", () => {
    const input = {
      zeta: { b: 1, a: 2 },
      alpha: [{ y: 1, x: 2 }, "s", 3],
      mid: null,
    };
    const out = sortKeysDeep(input);
    expect(Object.keys(out)).toEqual(["alpha", "mid", "zeta"]);
    expect(Object.keys(out.zeta)).toEqual(["a", "b"]);
    expect(Object.keys(out.alpha[0] as object)).toEqual(["x", "y"]);
    expect(out.alpha[1]).toBe("s");
    expect(out.alpha[2]).toBe(3);
    expect(out.mid).toBeNull();
  });

  it("does not mutate the input and produces no diff", () => {
    const input = { b: { d: 1, c: 2 }, a: 0 };
    const out = sortKeysDeep(input);
    expect(Object.keys(input)).toEqual(["b", "a"]);
    expect(computeDiff(input, out)).toEqual([]);
  });
});
