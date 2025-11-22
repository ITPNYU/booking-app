import { usePathname } from "next/navigation";

const ALLOWED_TENANTS = ["itp", "mc"] as const;
export type Tenant = (typeof ALLOWED_TENANTS)[number];

export function useTenant(): Tenant | null {
  const pathname = usePathname();

  // Extract tenant from pathname like /itp/admin or /mc/book
  const pathSegments = pathname.split("/").filter(Boolean);

  // The first segment should be the tenant
  if (pathSegments.length > 0) {
    const tenant = pathSegments[0] as Tenant;
    // Validate that it's a known tenant
    if (ALLOWED_TENANTS.includes(tenant)) {
      return tenant;
    }
  }

  return null;
}

// Utility function to validate tenant (can be used in layout.tsx)
export function isValidTenant(tenant: string): tenant is Tenant {
  return ALLOWED_TENANTS.includes(tenant as Tenant);
}
