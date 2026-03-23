import type { SchemaContextType } from "@/components/src/client/routes/components/SchemaProvider";
import { isValidTenant } from "@/components/src/constants/tenants";
import { TableNames } from "@/components/src/policy";
import { shouldBypassAuth } from "@/lib/utils/testEnvironment";
import { getTestTenantSchema } from "@/lib/utils/testTenantSchema";
import { cache } from "react";

/**
 * Single fetch per request for tenant schema (shared by layout + generateMetadata).
 */
export const getCachedTenantSchema = cache(
  async (tenant: string): Promise<SchemaContextType | null> => {
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
  },
);
