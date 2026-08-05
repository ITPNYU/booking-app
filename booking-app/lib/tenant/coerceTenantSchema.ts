import type {
  EmailNotifications,
  Resource,
  SchemaContextType,
} from "@/components/src/client/routes/components/schemaTypes";
import { generateDefaultSchema } from "@/components/src/client/routes/components/schemaTypes";
import { TENANTS } from "@/components/src/constants/tenants";
import { applyMcResourceServices } from "./mcResourceServices";
import { normalizeResourceServices } from "./migrateResourceServices";

function isMcTenantSlug(tenantSlug: string): boolean {
  return (
    tenantSlug === TENANTS.MC || tenantSlug === TENANTS.MEDIA_COMMONS
  );
}

function applyTenantResourceServices(
  resource: Resource,
  tenantSlug: string,
): Resource {
  const withMc = isMcTenantSlug(tenantSlug)
    ? applyMcResourceServices(resource)
    : resource;
  return normalizeResourceServices(withMc);
}

function normalizeResourceId(value: unknown, field: string): string {
  if (
    (typeof value !== "string" && typeof value !== "number") ||
    (typeof value === "number" && !Number.isFinite(value))
  ) {
    throw new Error(`${field} must be a string or finite number`);
  }
  const resourceId = String(value);
  if (!resourceId.trim()) {
    throw new Error(`${field} must be non-empty`);
  }
  if (resourceId.includes(",")) {
    throw new Error(`${field} must not contain commas`);
  }
  return resourceId;
}

function coerceResource(
  rawResource: Resource | Record<string, unknown>,
  index: number,
): Resource {
  const {
    roomId,
    resourceId,
    ...resource
  } = rawResource as Record<string, unknown>;
  const canonicalId =
    resourceId === undefined
      ? normalizeResourceId(roomId, `resources[${index}].roomId`)
      : normalizeResourceId(resourceId, `resources[${index}].resourceId`);

  if (
    roomId !== undefined &&
    normalizeResourceId(roomId, `resources[${index}].roomId`) !== canonicalId
  ) {
    throw new Error(
      `resources[${index}] has conflicting resourceId and roomId`,
    );
  }

  return {
    ...resource,
    resourceId: canonicalId,
  } as Resource;
}

function coerceResources(
  resources: Array<Resource | Record<string, unknown>>,
): Resource[] {
  const seen = new Set<string>();
  return resources.map((resource, index) => {
    const coerced = coerceResource(resource, index);
    if (seen.has(coerced.resourceId)) {
      throw new Error(`resources has duplicate resourceId "${coerced.resourceId}"`);
    }
    seen.add(coerced.resourceId);
    return coerced;
  });
}

/**
 * Normalizes a tenant schema document from Firestore into SchemaContextType by
 * merging the stored (canonical nested-shape) document over the tenant
 * defaults, so schema fields that a document omits fall back to their defaults.
 */
export function coerceTenantSchema(
  raw: Record<string, unknown> | null | undefined,
  tenantSlug: string,
): SchemaContextType {
  const base = generateDefaultSchema(tenantSlug);
  if (!raw || typeof raw !== "object") {
    return base;
  }

  const rawCc = raw.calendarConfig as
    | SchemaContextType["calendarConfig"]
    | undefined;
  const rawForm = raw.form as SchemaContextType["form"] | undefined;

  return {
    ...base,
    ...raw,
    tenantId: (raw.tenantId as string) || tenantSlug,
    tenant: {
      ...base.tenant,
      ...(raw.tenant as SchemaContextType["tenant"]),
    },
    mappings: {
      ...base.mappings,
      ...(raw.mappings as SchemaContextType["mappings"]),
    },
    form: {
      ...base.form,
      ...rawForm,
      services: {
        ...base.form.services,
        ...(rawForm?.services ?? {}),
      },
    },
    origins: {
      ...base.origins,
      ...(raw.origins as SchemaContextType["origins"]),
    },
    emailNotifications: {
      ...base.emailNotifications,
      ...(raw.emailNotifications as EmailNotifications),
    },
    calendarConfig: {
      ...base.calendarConfig,
      ...rawCc,
      timeSensitiveRequestWarning: {
        ...base.calendarConfig?.timeSensitiveRequestWarning,
        ...rawCc?.timeSensitiveRequestWarning,
      },
    },
    resources: (Array.isArray(raw.resources)
      ? coerceResources(
          raw.resources as Array<Resource | Record<string, unknown>>,
        )
      : base.resources
    ).map((resource) => applyTenantResourceServices(resource, tenantSlug)),
    attestations: Array.isArray(raw.attestations)
      ? (raw.attestations as SchemaContextType["attestations"])
      : base.attestations,
  } as SchemaContextType;
}
