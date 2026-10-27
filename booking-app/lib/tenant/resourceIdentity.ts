export type SchemaIssue = {
  path: string;
  message: string;
};

/** Coerce's thrown text. Duplicate ids keep the historical wording. */
export function formatSchemaIssue(issue: SchemaIssue): string {
  if (issue.message.startsWith("duplicate resourceId")) {
    return `resources has ${issue.message}`;
  }
  if (!issue.path) return issue.message;
  return `${issue.path} ${issue.message}`;
}

export function formatSchemaIssues(issues: SchemaIssue[]): string {
  return issues
    .map((issue) => (issue.path ? `${issue.path}: ${issue.message}` : issue.message))
    .join("; ");
}

type IdParse = { ok: true; id: string } | { ok: false; issue: SchemaIssue };

export function parseResourceId(value: unknown, path: string): IdParse {
  if (
    (typeof value !== "string" && typeof value !== "number") ||
    (typeof value === "number" && !Number.isFinite(value))
  ) {
    return {
      ok: false,
      issue: { path, message: "must be a string or finite number" },
    };
  }
  const id = String(value);
  if (!id.trim()) {
    return { ok: false, issue: { path, message: "must be non-empty" } };
  }
  if (id.includes(",")) {
    return { ok: false, issue: { path, message: "must not contain commas" } };
  }
  return { ok: true, id };
}

function fieldPath(base: string, field: string): string {
  return base ? `${base}.${field}` : field;
}

/**
 * Identity rules for one resource record. `base` is the path of the record
 * (`resources[0]` in a document, empty when that record is the whole value).
 * `seen` tracks ids already accepted in the same list.
 */
export function resourceRecordIssues(
  record: Record<string, unknown>,
  base: string,
  seen: Set<string>,
): SchemaIssue[] {
  const { roomId, resourceId } = record;
  let canonical: string | undefined;

  if (resourceId === undefined) {
    const parsed = parseResourceId(roomId, fieldPath(base, "roomId"));
    if (!parsed.ok) return [parsed.issue];
    canonical = parsed.id;
  } else {
    const parsed = parseResourceId(resourceId, fieldPath(base, "resourceId"));
    if (!parsed.ok) return [parsed.issue];
    canonical = parsed.id;
  }

  if (roomId !== undefined && resourceId !== undefined) {
    const parsedRoom = parseResourceId(roomId, fieldPath(base, "roomId"));
    if (!parsedRoom.ok) return [parsedRoom.issue];
    if (parsedRoom.id !== canonical) {
      return [
        {
          path: base,
          message: "has conflicting resourceId and roomId",
        },
      ];
    }
  }

  if (seen.has(canonical)) {
    return [
      {
        path: fieldPath(base, resourceId === undefined ? "roomId" : "resourceId"),
        message: `duplicate resourceId "${canonical}"`,
      },
    ];
  }
  seen.add(canonical);
  return [];
}

/** Identity rules for a `resources` array. Non-objects are left to JSON Schema. */
export function resourceIdentityIssues(
  resources: unknown,
  pathPrefix = "resources",
): SchemaIssue[] {
  if (!Array.isArray(resources)) return [];
  const issues: SchemaIssue[] = [];
  const seen = new Set<string>();
  resources.forEach((raw, index) => {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return;
    const base = pathPrefix ? `${pathPrefix}[${index}]` : `[${index}]`;
    issues.push(
      ...resourceRecordIssues(raw as Record<string, unknown>, base, seen),
    );
  });
  return issues;
}
