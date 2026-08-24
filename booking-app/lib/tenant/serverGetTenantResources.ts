import type { Resource } from "@/components/src/client/routes/components/schemaTypes";
import { DEFAULT_TENANT } from "@/components/src/constants/tenants";
import { TableNames } from "@/components/src/policy";
import { serverGetDocumentById } from "@/lib/firebase/server/adminDb";
import { applyEnvironmentCalendarIds } from "@/lib/utils/calendarEnvironment";

/**
 * Fetch a tenant's resources with environment-specific calendar IDs applied.
 * Returns [] when the schema document or its resources are missing so callers
 * can degrade gracefully (e.g. skip annex invitations).
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
