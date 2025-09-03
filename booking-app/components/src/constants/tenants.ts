// Tenant constants
export const TENANTS = {
  MC: "mc",
  MEDIA_COMMONS: "mediaCommons",
  ITP: "itp",
} as const;

export type TenantKey = keyof typeof TENANTS;
export type TenantValue = (typeof TENANTS)[TenantKey];

// Default tenant
export const DEFAULT_TENANT = TENANTS.MC;

// List of allowed tenants
export const ALLOWED_TENANTS = Object.values(TENANTS);

// Utility function to check if a string is a valid tenant
export const isValidTenant = (tenant: string): tenant is TenantValue => {
  return ALLOWED_TENANTS.includes(tenant as TenantValue);
};

// Utility function to check if tenant is Media Commons (handles both MC and MEDIA_COMMONS)
export const isMediaCommonsTenant = (tenant?: string): boolean => {
  return tenant === TENANTS.MC || tenant === TENANTS.MEDIA_COMMONS;
};
