import {
  defaultResource,
  type Resource,
} from "@/components/src/client/routes/components/schemaTypes";

/** Firestore document that holds the resource copied into new rows. Not a tenant. */
export const TEMPLATE_SCHEMA_ID = "_template";

export function isTemplateSchemaId(value: string): boolean {
  return value === TEMPLATE_SCHEMA_ID;
}

export type ResourceDefaultDocument = {
  resourceDefault: Resource;
};

/** A Firestore-safe copy. Array `__defaults__` is not a stored field. */
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

/** Fill missing nested fields from the base resource. Arrays and scalars in the overlay win. */
export function mergeResource(base: Resource, overlay: unknown): Resource {
  const left = plainResource(base);
  if (!left) return plainResourceDefault();
  const right = plainResource(overlay);
  if (!right) return left;
  return deepMerge(left, right) as Resource;
}

export function resourceIdError(
  resourceId: string,
  existingIds: string[],
): string | null {
  const id = resourceId.trim();
  if (!id) return "Resource id is required";
  if (id.includes(",")) return "Resource id must not contain commas";
  if (existingIds.includes(id)) {
    return `Resource id "${id}" is already in the schema`;
  }
  return null;
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
