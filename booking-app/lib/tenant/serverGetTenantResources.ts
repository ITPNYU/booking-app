import type { Resource } from "@/components/src/client/routes/components/schemaTypes";
import { DEFAULT_TENANT } from "@/components/src/constants/tenants";
import { TableNames } from "@/components/src/policy";
import { serverGetDocumentById } from "@/lib/firebase/server/adminDb";
import { applyEnvironmentCalendarIds } from "@/lib/utils/calendarEnvironment";

/**
 * Fetch a tenant's resources with environment-specific calendar IDs applied.
 * A resource missing its production calendar id is omitted by
 * applyEnvironmentCalendarIds; that does not drop the rest of the tenant.
 * Returns [] only when the schema document or its resources are missing, or
 * when the fetch itself fails, so callers can tell an empty catalog from a
 * single room that has no calendar.
 */
export async function serverGetTenantResources(
  tenant?: string,
): Promise<Resource[]> {
  try {
    const schema = await serverGetDocumentById<{ resources?: unknown }>(
      TableNames.TENANT_SCHEMA,
      tenant || DEFAULT_TENANT,
    );
    if (!schema?.resources || !Array.isArray(schema.resources)) {
      return [];
    }
    return applyEnvironmentCalendarIds(schema.resources as Resource[]).map(
      (resource: any) => ({
        ...resource,
        resourceId: String(resource.resourceId ?? resource.roomId ?? ""),
      }),
    );
  } catch (error) {
    console.error("Error fetching tenant resources:", error);
    return [];
  }
}
