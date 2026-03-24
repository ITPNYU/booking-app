import type { SchemaContextType } from "@/components/src/client/routes/components/SchemaProvider";
import { isValidTenant } from "@/components/src/constants/tenants";
import { TableNames } from "@/components/src/policy";
import { shouldBypassAuth } from "@/lib/utils/testEnvironment";
import { getTestTenantSchema } from "@/lib/utils/testTenantSchema";

/**
 * Fetch tenant schema, shared by layout and generateMetadata.
 */
export async function getCachedTenantSchema(
  tenant: string,
): Promise<SchemaContextType | null> {
  if (!isValidTenant(tenant)) {
    return null;
  }
  if (shouldBypassAuth()) {
    return getTestTenantSchema(tenant);
  }
  const { serverGetDocumentById } =
    await import("@/lib/firebase/server/adminDb");
  return serverGetDocumentById<SchemaContextType>(
    TableNames.TENANT_SCHEMA,
    tenant,
  );
}
