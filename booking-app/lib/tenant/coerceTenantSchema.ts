import type {
  EmailNotifications,
  Resource,
  SchemaContextType,
} from "@/components/src/client/routes/components/schemaTypes";
import { generateDefaultSchema } from "@/components/src/client/routes/components/schemaTypes";

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
    resources: Array.isArray(raw.resources)
      ? (raw.resources as Resource[])
      : base.resources,
    attestations: Array.isArray(raw.attestations)
      ? (raw.attestations as SchemaContextType["attestations"])
      : base.attestations,
  } as SchemaContextType;
}
