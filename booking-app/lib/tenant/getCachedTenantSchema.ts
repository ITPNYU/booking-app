import type { SchemaContextType } from "@/components/src/client/routes/components/SchemaProvider";
import { isValidTenant } from "@/components/src/constants/tenants";
import { TableNames } from "@/components/src/policy";
import { shouldBypassAuth } from "@/lib/utils/testEnvironment";
import { getTestTenantSchema } from "@/lib/utils/testTenantSchema";

// In-memory cache scoped to the current request lifecycle (Next.js server).
// generateMetadata and the Layout component run in the same request,
// so this avoids a duplicate Firestore read.
const cache = new Map<string, { data: SchemaContextType | null; ts: number }>();
const TTL_MS = 30_000; // 30 seconds

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

  const now = Date.now();
  const cached = cache.get(tenant);
  if (cached && now - cached.ts < TTL_MS) {
    return cached.data;
  }

  const { serverGetDocumentById } =
    await import("@/lib/firebase/server/adminDb");
  const data = await serverGetDocumentById<SchemaContextType>(
    TableNames.TENANT_SCHEMA,
    tenant,
  );
  cache.set(tenant, { data, ts: now });
  return data;
}
