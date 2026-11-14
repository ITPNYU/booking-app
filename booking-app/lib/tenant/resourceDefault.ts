import {
  defaultResource,
  type Resource,
} from "@/components/src/client/routes/components/schemaTypes";
import { resourceIdError as resourceIdIssue } from "@/lib/tenant/validateTenantSchema";

export { resourceIdIssue as resourceIdError };

/** Reserved document id. The editor no longer reads or writes this document. */
export const TEMPLATE_SCHEMA_ID = "_template";

export function isTemplateSchemaId(value: string): boolean {
  return value === TEMPLATE_SCHEMA_ID;
}

/** A JSON copy, so the editor can change a room without mutating the shared default. */
export function plainResource(value: unknown): Resource | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return JSON.parse(JSON.stringify(value)) as Resource;
}

export function plainResourceDefault(): Resource {
  const resource = plainResource(defaultResource);
  if (!resource) {
    throw new Error("defaultResource is not a plain object");
  }
  return resource;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function cloneValue<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function deepMerge(base: unknown, overlay: unknown): unknown {
  if (Array.isArray(overlay) || !isRecord(overlay) || !isRecord(base)) {
    return cloneValue(overlay);
  }
  const result = cloneValue(base) as Record<string, unknown>;
  for (const [key, value] of Object.entries(overlay)) {
    result[key] = key in result ? deepMerge(result[key], value) : cloneValue(value);
  }
  return result;
}

function sameValue(left: unknown, right: unknown): boolean {
  if (left === right) return true;
  if (Array.isArray(left) || Array.isArray(right)) {
    return JSON.stringify(left) === JSON.stringify(right);
  }
  if (isRecord(left) && isRecord(right)) {
    const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
    for (const key of keys) {
      if (!sameValue(left[key], right[key])) return false;
    }
    return true;
  }
  return false;
}

/**
 * Keep the stored resource, and apply only the fields the form actually changed.
 * Defaults shown for missing fields are not written back unless they were edited.
 */
export function projectResourceEdits(
  original: Resource,
  initial: Resource,
  current: Resource,
): Resource {
  return projectNode(original, initial, current) as Resource;
}

function projectNode(
  original: unknown,
  initial: unknown,
  current: unknown,
): unknown {
  if (sameValue(current, initial)) {
    return original === undefined ? undefined : cloneValue(original);
  }
  if (current === undefined) return undefined;
  const originalRecord = isRecord(original) ? original : undefined;
  if (
    isRecord(current) &&
    isRecord(initial) &&
    (original === undefined || isRecord(original))
  ) {
    const keys = new Set([
      ...Object.keys(current),
      ...Object.keys(originalRecord ?? {}),
    ]);
    const result: Record<string, unknown> = {};
    for (const key of keys) {
      const next = projectNode(
        originalRecord?.[key],
        initial[key],
        current[key],
      );
      if (next !== undefined) result[key] = next;
    }
    return result;
  }
  return cloneValue(current);
}

/** Fill missing nested fields from the base resource. Arrays and scalars in the overlay win. */
export function mergeResource(base: Resource, overlay: unknown): Resource {
  const left = plainResource(base);
  if (!left) return plainResourceDefault();
  const right = plainResource(overlay);
  if (!right) return left;
  return deepMerge(left, right) as Resource;
}

export type ResourceFormFields = {
  name: string;
  resourceId: string;
  capacity: number;
  calendarId: string;
  calendarIdProd: string;
  isEquipment: boolean;
  isWalkIn: boolean;
};

/** Copy the stored default, then overwrite the room-specific fields. */
export function resourceFromDefault(
  resourceDefault: Resource,
  fields: ResourceFormFields,
): Resource {
  const base = plainResource(resourceDefault);
  if (!base) {
    throw new Error("resourceDefault must be an object");
  }
  return {
    ...base,
    name: fields.name,
    resourceId: fields.resourceId.trim(),
    capacity: fields.capacity,
    calendarId: fields.calendarId,
    calendarIdProd: fields.calendarIdProd,
    isEquipment: fields.isEquipment,
    isWalkIn: fields.isWalkIn,
  };
}
