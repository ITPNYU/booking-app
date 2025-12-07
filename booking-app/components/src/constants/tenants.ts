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

// Calendar slot unit / increment in minutes
export const SLOT_UNIT = 15;

// Convert minutes to FullCalendar duration string (HH:MM:00 format)
export function minutesToDurationString(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  const hh = hours.toString().padStart(2, "0");
  const mm = mins.toString().padStart(2, "0");
  return `${hh}:${mm}:00`;
}

// Utility function to check if tenant is Media Commons (handles both MC and MEDIA_COMMONS)
export const isMediaCommonsTenant = (tenant?: string): boolean => {
  return tenant === TENANTS.MC || tenant === TENANTS.MEDIA_COMMONS;
};
