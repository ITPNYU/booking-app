import { TENANTS } from "@/components/src/constants/tenants";
import { TEMPLATE_SCHEMA_ID } from "@/lib/tenant/resourceDefault";

/**
 * Slugs that must not be created as new tenant schema documents.
 * `mediaCommons` stays a legacy alias of `mc`.
 */
export const RESERVED_TENANT_SLUGS = [
  TEMPLATE_SCHEMA_ID,
  "api",
  "signin",
  TENANTS.MEDIA_COMMONS,
] as const;

const TENANT_SLUG_PATTERN = /^[a-z][a-z0-9-]{0,30}$/;

/** Slug that may be written as a new `tenantSchema/{slug}` document. */
export function isCreatableTenantSlug(value: string): boolean {
  return (
    TENANT_SLUG_PATTERN.test(value) &&
    !(RESERVED_TENANT_SLUGS as readonly string[]).includes(value)
  );
}
