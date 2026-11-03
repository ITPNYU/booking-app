/**
 * Pure helpers for the section-scoped schema editor.
 *
 * The editor shows one slice of the tenant schema at a time (the whole
 * document, one top-level key, or one resource). These helpers map a
 * selection to its slice, write a slice back, and tell which slices are
 * dirty relative to the saved schema.
 */
import type { DiffEntry } from "@/lib/utils/schemaDiff";

export type Selection =
  | { kind: "all" }
  | { kind: "section"; key: string }
  | { kind: "resource"; index: number };

export const SELECT_ALL: Selection = { kind: "all" };

export function selectionId(sel: Selection): string {
  switch (sel.kind) {
    case "all":
      return "all";
    case "section":
      return `section:${sel.key}`;
    case "resource":
      return `resource:${sel.index}`;
  }
}

export function isSameSelection(a: Selection, b: Selection): boolean {
  return selectionId(a) === selectionId(b);
}

/** Diff-path prefix covered by a selection ("" for the whole document). */
export function pathPrefix(sel: Selection): string {
  switch (sel.kind) {
    case "all":
      return "";
    case "section":
      return sel.key;
    case "resource":
      return `resources[${sel.index}]`;
  }
}

/** True when any diff entry falls under the selection's path prefix. */
export function isDirtyUnder(diffs: DiffEntry[], prefix: string): boolean {
  if (prefix === "") return diffs.length > 0;
  return diffs.some(
    (d) =>
      d.path === prefix ||
      d.path.startsWith(`${prefix}.`) ||
      d.path.startsWith(`${prefix}[`),
  );
}

type AnyRecord = Record<string, unknown>;

function resourcesOf(schema: AnyRecord): unknown[] {
  const r = schema.resources;
  return Array.isArray(r) ? r : [];
}

/**
 * Read the slice a selection points at. `fallback` supplies the value for a
 * top-level key the schema does not have yet (the code default), so the
 * editor can show something to start from.
 */
export function getSlice(
  schema: AnyRecord,
  sel: Selection,
  fallback: AnyRecord = {},
): unknown {
  switch (sel.kind) {
    case "all":
      return schema;
    case "section":
      return sel.key in schema ? schema[sel.key] : fallback[sel.key];
    case "resource":
      return resourcesOf(schema)[sel.index];
  }
}

/**
 * Return a new schema with the selection's slice replaced. The input is not
 * mutated. For a top-level key that is absent from `original` (i.e. the
 * tenant relies on the code default), writing a value equal to `fallback`
 * leaves the key absent so the save diff stays empty.
 */
export function setSlice(
  schema: AnyRecord,
  sel: Selection,
  value: unknown,
  opts: { original?: AnyRecord; fallback?: AnyRecord } = {},
): AnyRecord {
  switch (sel.kind) {
    case "all":
      return value as AnyRecord;
    case "section": {
      const { original, fallback } = opts;
      const wasUnconfigured = original ? !(sel.key in original) : false;
      if (
        wasUnconfigured &&
        fallback &&
        JSON.stringify(value) === JSON.stringify(fallback[sel.key])
      ) {
        const { [sel.key]: _omit, ...rest } = schema;
        return rest;
      }
      return { ...schema, [sel.key]: value };
    }
    case "resource": {
      const next = resourcesOf(schema).slice();
      next[sel.index] = value;
      return { ...schema, resources: next };
    }
  }
}

export type ResourceLabel = {
  index: number;
  name: string;
  resourceId: string;
  isEquipment: boolean;
  parentResourceId?: string;
};

export function resourceLabels(schema: AnyRecord): ResourceLabel[] {
  return resourcesOf(schema).map((raw, index) => {
    const r = (raw ?? {}) as AnyRecord;
    return {
      index,
      name: typeof r.name === "string" && r.name ? r.name : `#${index}`,
      resourceId: r.resourceId == null ? "" : String(r.resourceId),
      isEquipment: r.isEquipment === true,
      parentResourceId:
        r.parentResourceId == null ? undefined : String(r.parentResourceId),
    };
  });
}

/**
 * For a diff path under `resources[i]`, return a human label for that
 * resource ("Room 103 (resourceId 12)") looked up in either side of the
 * diff. Undefined for any other path.
 */
export function resourceLabelForPath(
  path: string,
  before: AnyRecord,
  after: AnyRecord,
): string | undefined {
  const m = /^resources\[(\d+)\]/.exec(path);
  if (!m) return undefined;
  const index = Number(m[1]);
  const pick = (schema: AnyRecord) =>
    resourcesOf(schema)[index] as AnyRecord | undefined;
  const r = pick(after) ?? pick(before);
  if (!r) return undefined;
  const name = typeof r.name === "string" && r.name ? r.name : `#${index}`;
  const id = r.resourceId == null ? "" : ` (resourceId ${r.resourceId})`;
  return `${name}${id}`;
}

/**
 * Top-level keys to list in the sidebar, alphabetically. Includes code-default
 * keys the stored schema does not have yet. `present` marks keys the stored
 * schema actually contains.
 */
export function sectionKeys(
  schema: AnyRecord,
  defaults: AnyRecord,
): { key: string; present: boolean }[] {
  const ordered = [
    ...Object.keys(defaults),
    ...Object.keys(schema).filter((k) => !(k in defaults)),
  ].sort();
  return ordered.map((key) => ({ key, present: key in schema }));
}

/**
 * Return a deep copy with object keys sorted alphabetically at every level,
 * so the editor's JSON reads in the same order as the Firestore console.
 * Arrays keep their order. Key order carries no meaning for the schema, so
 * this is display-only and does not create diffs.
 */
export function sortKeysDeep<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => sortKeysDeep(item)) as unknown as T;
  }
  if (value !== null && typeof value === "object") {
    const sorted: AnyRecord = {};
    for (const key of Object.keys(value as AnyRecord).sort()) {
      sorted[key] = sortKeysDeep((value as AnyRecord)[key]);
    }
    return sorted as T;
  }
  return value;
}
