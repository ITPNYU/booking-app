import { TENANTS, isValidTenant } from "@/components/src/constants/tenants";

/** Firestore document that holds the blank schema. It is not a tenant. */
export const TEMPLATE_SCHEMA_ID = "_template";

/**
 * Slugs that must not be created as new tenants.
 * `mediaCommons` stays a legacy alias of `mc`.
 */
export const RESERVED_TENANT_SLUGS = [
  TEMPLATE_SCHEMA_ID,
  "api",
  "signin",
  TENANTS.MEDIA_COMMONS,
] as const;

const TENANT_SLUG_PATTERN = /^[a-z][a-z0-9-]{0,30}$/;

export function isTemplateSchemaId(value: string): boolean {
  return value === TEMPLATE_SCHEMA_ID;
}

/** Lowercase slug shape used for new tenants and for route segments. */
export function isTenantSlugShape(value: string): boolean {
  return TENANT_SLUG_PATTERN.test(value);
}

export function isReservedTenantSlug(value: string): boolean {
  return (RESERVED_TENANT_SLUGS as readonly string[]).includes(value);
}

/** Slug that may be written as a new `tenantSchema/{slug}` document. */
export function isCreatableTenantSlug(value: string): boolean {
  return isTenantSlugShape(value) && !isReservedTenantSlug(value);
}

/** `mediaCommons` loads the `mc` schema. Every other slug is unchanged. */
export function canonicalizeTenantSlug(value: string): string {
  return value === TENANTS.MEDIA_COMMONS ? TENANTS.MC : value;
}

/**
 * Sync gate for routes that accept either a legacy tenant or a new slug.
 * Does not check that a schema document exists.
 */
export function isAddressableTenantSlug(value: string): boolean {
  if (!value || isTemplateSchemaId(value)) return false;
  return isValidTenant(value) || isCreatableTenantSlug(value);
}
