import {
  resourcesArraySchema,
  tenantResourceSchema,
  tenantSchema,
} from "@/components/src/client/routes/components/schemaTypes";

export type SchemaIssue = {
  path: string;
  message: string;
};

export type SchemaSlice =
  | { kind: "all" }
  | { kind: "section"; key: string }
  | { kind: "resource"; index: number };

function issuePath(path: PropertyKey[]): string {
  let out = "";
  for (const part of path) {
    if (typeof part === "number") {
      out += `[${part}]`;
      continue;
    }
    const key = String(part);
    out = out ? `${out}.${key}` : key;
  }
  return out;
}

export function formatSchemaIssues(
  error: { issues: { path: PropertyKey[]; message: string }[] },
): SchemaIssue[] {
  return error.issues.map((issue) => ({
    path: issuePath(issue.path),
    message: issue.message,
  }));
}

function issuesFromResult(result: { success: boolean }): SchemaIssue[] {
  if ("error" in result && result.error) {
    return formatSchemaIssues(
      result.error as { issues: { path: PropertyKey[]; message: string }[] },
    );
  }
  return [];
}

/** Issues for a whole tenant document. An empty list means the document is valid. */
export function validateTenantDocument(value: unknown): SchemaIssue[] {
  return issuesFromResult(tenantSchema.safeParse(value));
}

/**
 * Issues for the JSON slice open in the editor: the whole document, one
 * top-level key, or one resource. Unknown keys are allowed.
 */
export function validateSchemaSlice(
  selection: SchemaSlice,
  value: unknown,
): SchemaIssue[] {
  if (selection.kind === "all") return validateTenantDocument(value);
  if (selection.kind === "resource") {
    return issuesFromResult(tenantResourceSchema.safeParse(value));
  }
  const field = (
    tenantSchema.shape as Record<string, { safeParse: (data: unknown) => { success: boolean } }>
  )[selection.key];
  if (!field) return [];
  return issuesFromResult(field.safeParse(value));
}

/**
 * Message for the add-resource form. The id rules are the tenant resource
 * schema; uniqueness is the resources-array rule against the other rooms.
 */
export function resourceIdError(
  resourceId: string,
  existingIds: string[],
): string | null {
  const parsed = resourcesArraySchema.safeParse([
    ...existingIds.map((id) => ({ resourceId: id })),
    { resourceId },
  ]);
  if (!("error" in parsed)) return null;
  const index = existingIds.length;
  const issue =
    parsed.error.issues.find((item) => item.path[0] === index) ??
    parsed.error.issues[0];
  return issue?.message ?? "Invalid resource id";
}
