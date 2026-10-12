import { usePathname } from "next/navigation";
import {
  canonicalizeTenantSlug,
  isTemplateSchemaId,
  isTenantSlugShape,
} from "@/lib/tenant/tenantSlug";

/**
 * Tenant slug from the first URL segment.
 * `mediaCommons` is returned as `mc`. Unknown shapes return null; the layout
 * 404s when no schema document exists for a well-formed slug.
 */
export function useTenant(): string | null {
  const pathname = usePathname();
  const pathSegments = pathname.split("/").filter(Boolean);
  if (pathSegments.length === 0) return null;

  const tenant = pathSegments[0];
  if (isTemplateSchemaId(tenant)) return null;
  const canonical = canonicalizeTenantSlug(tenant);
  if (!isTenantSlugShape(canonical)) return null;
  return canonical;
}

export function isValidTenant(tenant: string): boolean {
  if (isTemplateSchemaId(tenant)) return false;
  return isTenantSlugShape(canonicalizeTenantSlug(tenant));
}
