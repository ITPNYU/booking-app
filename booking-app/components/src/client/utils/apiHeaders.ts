import { DEFAULT_TENANT } from "@/components/src/constants/tenants";

/**
 * Build headers for tenant-scoped API requests. Use this for any client fetch
 * that needs the x-tenant header so tenant handling stays in one place.
 */
export function getApiHeaders(
  tenant: string | undefined,
  extra?: Record<string, string>
): Record<string, string> {
  const headers: Record<string, string> = {
    "x-tenant": tenant || DEFAULT_TENANT,
  };
  if (extra) {
    Object.assign(headers, extra);
  }
  return headers;
}
