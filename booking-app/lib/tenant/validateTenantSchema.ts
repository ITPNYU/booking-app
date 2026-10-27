import Ajv, { type AnySchema, type ErrorObject, type ValidateFunction } from "ajv";
import type { Selection } from "@/components/src/client/routes/super/schemaEditorNav";
import tenantSchema from "./tenantSchema.schema.json";
import {
  formatSchemaIssues,
  resourceIdentityIssues,
  resourceRecordIssues,
  type SchemaIssue,
} from "./resourceIdentity";

export type { SchemaIssue };
export { formatSchemaIssues };

const SCHEMA_ID = "https://booking-app/tenant-schema.json";

type Definition = { properties?: Record<string, unknown> };

const definitions = (
  tenantSchema as { definitions?: Record<string, Definition> }
).definitions ?? {};
const rootProperties = definitions.SchemaContextType?.properties ?? {};

const ajv = new Ajv({ allErrors: true, strict: false });
ajv.addSchema(tenantSchema as AnySchema);

const validators = new Map<string, ValidateFunction>();

function validatorFor(ref: string): ValidateFunction {
  const cached = validators.get(ref);
  if (cached) return cached;
  const validate = ajv.compile({ $ref: ref });
  validators.set(ref, validate);
  return validate;
}

function pointerToken(key: string): string {
  return key.replace(/~/g, "~0").replace(/\//g, "~1");
}

function jsonPointerToPath(pointer: string): string {
  if (!pointer) return "";
  let path = "";
  for (const raw of pointer.split("/").slice(1)) {
    const part = raw.replace(/~1/g, "/").replace(/~0/g, "~");
    if (/^\d+$/.test(part)) path += `[${part}]`;
    else path = path ? `${path}.${part}` : part;
  }
  return path;
}

function ajvIssues(validate: ValidateFunction, data: unknown): SchemaIssue[] {
  if (validate(data)) return [];
  return (validate.errors ?? []).map((error: ErrorObject) => ({
    path: jsonPointerToPath(error.instancePath),
    message: error.message ?? "is invalid",
  }));
}

function sectionRef(key: string): string | null {
  if (!(key in rootProperties)) return null;
  return `${SCHEMA_ID}#/definitions/SchemaContextType/properties/${pointerToken(key)}`;
}

const resourceValidator = () => validatorFor(`${SCHEMA_ID}#/definitions/Resource`);

const documentValidator = () => validatorFor(SCHEMA_ID);

const templateValidator = () => validatorFor("https://booking-app/resource-default.json");

ajv.addSchema({
  $id: "https://booking-app/resource-default.json",
  type: "object",
  required: ["resourceDefault"],
  additionalProperties: true,
  properties: {
    resourceDefault: { $ref: `${SCHEMA_ID}#/definitions/Resource` },
  },
});

export function validateTenantDocument(value: unknown): SchemaIssue[] {
  const issues = ajvIssues(documentValidator(), value);
  if (value && typeof value === "object" && !Array.isArray(value)) {
    issues.push(
      ...resourceIdentityIssues((value as { resources?: unknown }).resources),
    );
  }
  return issues;
}

export function validateTemplateDocument(value: unknown): SchemaIssue[] {
  return ajvIssues(templateValidator(), value);
}

function validateResource(value: unknown, allowEmptyId: boolean): SchemaIssue[] {
  const issues = ajvIssues(resourceValidator(), value);
  if (allowEmptyId || !value || typeof value !== "object" || Array.isArray(value)) {
    return issues;
  }
  issues.push(
    ...resourceRecordIssues(value as Record<string, unknown>, "", new Set()),
  );
  return issues;
}

/**
 * Validate the slice the schema editor is showing. Paths are relative to
 * that slice. Resource-id rules apply to tenant resources, including a
 * single resource, and not to the `_template` resource default (its id may
 * be empty until a room is created from it).
 */
export function validateSchemaSlice(
  selection: Selection,
  value: unknown,
  options: { template?: boolean } = {},
): SchemaIssue[] {
  if (options.template) {
    if (selection.kind === "all") return validateTemplateDocument(value);
    if (selection.kind === "section" && selection.key === "resourceDefault") {
      return validateResource(value, true);
    }
    return [];
  }

  if (selection.kind === "all") return validateTenantDocument(value);

  if (selection.kind === "resource") return validateResource(value, false);

  const ref = sectionRef(selection.key);
  const issues = ref ? ajvIssues(validatorFor(ref), value) : [];
  if (selection.key === "resources") {
    issues.push(...resourceIdentityIssues(value, ""));
  }
  return issues;
}
