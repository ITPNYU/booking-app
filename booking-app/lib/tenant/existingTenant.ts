import { isValidTenant } from "@/components/src/constants/tenants";
import {
  canonicalizeTenantSlug,
  isCreatableTenantSlug,
  isTemplateSchemaId,
} from "@/lib/tenant/tenantSlug";

/**
 * True when `tenant` is a legacy tenant or a slug whose schema document exists.
 * `_template` is never a tenant. Legacy slugs stay valid without a read so
 * existing callers keep working when the document is briefly unavailable.
 */
export async function isExistingTenantSlug(tenant: string): Promise<boolean> {
  if (!tenant || isTemplateSchemaId(tenant)) return false;
  const canonical = canonicalizeTenantSlug(tenant);
  if (isValidTenant(tenant) || isValidTenant(canonical)) return true;
  if (!isCreatableTenantSlug(canonical)) return false;

  const { getCachedTenantSchema } = await import("./getCachedTenantSchema");
  const schema = await getCachedTenantSchema(canonical);
  return schema != null;
}
