import type {
  EmailNotifications,
  Resource,
  SchemaContextType,
  TimeSensitiveRequestWarning,
} from "@/components/src/client/routes/components/schemaTypes";
import { generateDefaultSchema } from "@/components/src/client/routes/components/schemaTypes";

function mapLegacyEmailMessages(
  legacy: Record<string, string> | undefined,
): Partial<EmailNotifications> {
  if (!legacy) return {};
  return {
    requestedUser: legacy.requestConfirmation || "",
    requestedNeedsApproval: legacy.firstApprovalRequest || "",
    reviewedNeedsApproval: legacy.secondApprovalRequest || "",
    approvedWalkIn: legacy.walkInConfirmation || "",
    approvedVIP: legacy.vipConfirmation || "",
    checkedOut: legacy.checkoutConfirmation || "",
    checkedIn: legacy.checkinConfirmation || "",
    declined: legacy.declined || "",
    canceled: legacy.canceled || "",
    canceledLate: legacy.lateCancel || "",
    noShow: legacy.noShow || "",
    closed: legacy.closed || "",
    approvedUser: legacy.approvalNotice || "",
  };
}

/**
 * Resolve the attestations array, preferring a populated `attestations`, then a
 * populated legacy `agreements`, so an empty array (e.g. an injected default)
 * never shadows real configured data. Falls back to the default schema.
 */
function pickAttestations(
  raw: Record<string, unknown>,
  base: SchemaContextType,
): SchemaContextType["attestations"] {
  const attestations = raw.attestations;
  if (Array.isArray(attestations) && attestations.length > 0) {
    return attestations as SchemaContextType["attestations"];
  }
  const agreements = raw.agreements;
  if (Array.isArray(agreements) && agreements.length > 0) {
    return agreements as SchemaContextType["attestations"];
  }
  if (Array.isArray(attestations)) {
    return attestations as SchemaContextType["attestations"];
  }
  return base.attestations;
}

function migrateResource(r: Record<string, unknown>): Resource {
  // Merge an existing nested `training` object with legacy flat fields so that
  // partially-migrated resources (e.g. `{ training: { required: true },
  // trainingInfoUrl: "..." }`) keep their legacy form/info URLs instead of
  // dropping them. Nested values win per-field; legacy fills any gaps.
  const nested =
    r.training && typeof r.training === "object" && !Array.isArray(r.training)
      ? (r.training as Partial<Resource["training"]>)
      : undefined;

  const hasLegacyTraining =
    r.needsSafetyTraining !== undefined ||
    r.trainingFormUrl !== undefined ||
    r.trainingInfoUrl !== undefined;

  const legacy = hasLegacyTraining
    ? {
        required: Boolean(r.needsSafetyTraining),
        formId: (r.trainingFormUrl as string) || "",
        infoUrl: (r.trainingInfoUrl as string) || "",
      }
    : undefined;

  const training: Resource["training"] = {
    required: nested?.required ?? legacy?.required ?? false,
    formId: nested?.formId || legacy?.formId || "",
    infoUrl: nested?.infoUrl || legacy?.infoUrl || "",
  };

  const {
    needsSafetyTraining: _n,
    trainingFormUrl: _f,
    trainingInfoUrl: _i,
    ...rest
  } = r;

  return { ...rest, training } as Resource;
}

function isNewSchemaShape(raw: Record<string, unknown>): boolean {
  // The nested shape is identified by `tenant`/`mappings`/`form` being objects.
  // `contextLabels` is optional and defaultable, so it must NOT be required
  // here — otherwise a nested document that simply omits it would be treated as
  // legacy and have its nested `tenant`/`mappings`/`form` blanked out.
  return Boolean(
    raw.mappings &&
      typeof raw.mappings === "object" &&
      !Array.isArray(raw.mappings) &&
      raw.form &&
      typeof raw.form === "object" &&
      !Array.isArray(raw.form) &&
      raw.tenant &&
      typeof raw.tenant === "object" &&
      !Array.isArray(raw.tenant),
  );
}

/**
 * Top-level keys from the legacy flat schema. If any are still present on a
 * document that otherwise looks "nested", Firestore should be rewritten so the
 * canonical nested-only shape is stored (avoids ambiguous round-trips).
 */
export const STALE_LEGACY_TOP_LEVEL_TENANT_SCHEMA_KEYS = [
  "name",
  "logo",
  "nameForPolicy",
  "permissionLabels",
  "programMapping",
  "roleMapping",
  "schoolMapping",
  "showBookingTypes",
  "showNNumber",
  "showSponsor",
  "showCatering",
  "showEquipment",
  "showHireSecurity",
  "showSetup",
  "showStaffing",
  "supportVIP",
  "supportWalkIn",
  "safetyTrainingGoogleFormId",
  "timeSensitiveRequestWarning",
  "emailMessages",
  "agreements",
] as const;

/** Legacy field names that may still live inside a `resources[]` entry. */
const STALE_LEGACY_RESOURCE_KEYS = [
  "needsSafetyTraining",
  "trainingFormUrl",
  "trainingInfoUrl",
] as const;

/** True when the stored document already matches the nested tenant schema shape. */
export function isNestedTenantSchemaDocument(
  raw: Record<string, unknown> | null | undefined,
): boolean {
  return Boolean(raw && typeof raw === "object" && isNewSchemaShape(raw));
}

/**
 * Whether a Firestore tenantSchema document should be rewritten to the canonical
 * nested shape (coerce + full replace). Used by one-off migration tooling.
 */
export function tenantSchemaFirestoreDocNeedsShapeMigration(
  raw: Record<string, unknown> | null | undefined,
): boolean {
  if (!raw || typeof raw !== "object") return false;
  if (typeof raw.tenant === "string") return true;
  if (!isNewSchemaShape(raw)) return true;
  const hasStaleTopLevel = STALE_LEGACY_TOP_LEVEL_TENANT_SCHEMA_KEYS.some(
    (k) =>
      Object.prototype.hasOwnProperty.call(raw, k) &&
      raw[k as string] !== undefined,
  );
  if (hasStaleTopLevel) return true;
  // A doc may be nested at the top level but still carry legacy fields inside
  // its resource entries (e.g. needsSafetyTraining / trainingFormUrl). Those
  // also need canonicalizing, so flag them too.
  const resources = raw.resources;
  if (Array.isArray(resources)) {
    return resources.some(
      (r) =>
        r &&
        typeof r === "object" &&
        STALE_LEGACY_RESOURCE_KEYS.some((k) =>
          Object.prototype.hasOwnProperty.call(r, k),
        ),
    );
  }
  return false;
}

/**
 * Normalizes a tenant schema document from Firestore (new or legacy shape)
 * into SchemaContextType.
 */
export function coerceTenantSchema(
  raw: Record<string, unknown> | null | undefined,
  tenantSlug: string,
): SchemaContextType {
  const base = generateDefaultSchema(tenantSlug);
  if (!raw || typeof raw !== "object") {
    return base;
  }

  if (isNewSchemaShape(raw)) {
    const rawCc = raw.calendarConfig as SchemaContextType["calendarConfig"] | undefined;
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
        ...(raw.form as SchemaContextType["form"]),
        services: {
          ...base.form.services,
          ...((raw.form as SchemaContextType["form"]).services ?? {}),
        },
      },
      origins: {
        ...base.origins,
        ...(raw.origins as SchemaContextType["origins"]),
      },
      emailNotifications: {
        ...base.emailNotifications,
        // Partially-migrated documents may still carry legacy `emailMessages`;
        // map them in first so nested `emailNotifications` only overrides them
        // when it actually has values.
        ...mapLegacyEmailMessages(
          raw.emailMessages as Record<string, string> | undefined,
        ),
        ...(raw.emailNotifications as EmailNotifications),
      },
      calendarConfig: {
        ...base.calendarConfig,
        ...rawCc,
        timeSensitiveRequestWarning: {
          ...base.calendarConfig?.timeSensitiveRequestWarning,
          // A partially-migrated document may have new-shape tenant/mappings/form
          // but still carry the warning at the legacy top level. Pick that up so
          // the warning banner is not silently dropped; the nested value (the
          // canonical location) wins when present.
          ...(typeof raw.timeSensitiveRequestWarning === "object" &&
          raw.timeSensitiveRequestWarning !== null
            ? (raw.timeSensitiveRequestWarning as Record<string, unknown>)
            : {}),
          ...rawCc?.timeSensitiveRequestWarning,
        },
      },
      resources: Array.isArray(raw.resources)
        ? raw.resources.map((x) => migrateResource(x as Record<string, unknown>))
        : base.resources,
      // Prefer a populated attestations array; fall back to legacy `agreements`
      // when present so an empty nested array does not shadow real data.
      attestations: pickAttestations(raw, base),
    } as SchemaContextType;
  }

  const legacyTenantString =
    typeof raw.tenant === "string" ? (raw.tenant as string) : undefined;

  const rawCal = raw.calendarConfig as
    | SchemaContextType["calendarConfig"]
    | undefined;
  const topWarning = raw.timeSensitiveRequestWarning as
    | TimeSensitiveRequestWarning
    | undefined;

  const calendarConfig: SchemaContextType["calendarConfig"] = {
    ...base.calendarConfig,
    ...rawCal,
    timeSensitiveRequestWarning: {
      ...base.calendarConfig?.timeSensitiveRequestWarning,
      ...rawCal?.timeSensitiveRequestWarning,
      ...(typeof topWarning === "object" && topWarning !== null
        ? (topWarning as Record<string, unknown>)
        : {}),
    },
  };

  const core: SchemaContextType = {
    ...base,
    tenantId: (raw.tenantId as string) || legacyTenantString || tenantSlug,
    tenant: {
      name: (raw.name as string) ?? "",
      logo: (raw.logo as string) ?? "",
      nameForPolicy: (raw.nameForPolicy as string) ?? "",
      contextLabels:
        (raw.permissionLabels as SchemaContextType["tenant"]["contextLabels"]) ||
        base.tenant.contextLabels,
    },
    policy: (raw.policy as string) ?? base.policy,
    mappings: {
      program:
        (raw.programMapping as Record<string, string[]>) ?? base.mappings.program,
      role: (raw.roleMapping as Record<string, string[]>) ?? base.mappings.role,
      school: (raw.schoolMapping as Record<string, string[]>) ?? base.mappings.school,
    },
    roles: (raw.roles as string[]) ?? base.roles,
    form: {
      showBookingType: (raw.showBookingTypes as boolean) ?? base.form.showBookingType,
      showNNumber: (raw.showNNumber as boolean) ?? base.form.showNNumber,
      showSponsor: (raw.showSponsor as boolean) ?? base.form.showSponsor,
      services: {
        showCatering: (raw.showCatering as boolean) ?? base.form.services.showCatering,
        showEquipment: (raw.showEquipment as boolean) ?? base.form.services.showEquipment,
        showSecurity: (raw.showHireSecurity as boolean) ?? base.form.services.showSecurity,
        showSetup: (raw.showSetup as boolean) ?? base.form.services.showSetup,
        showStaffing: (raw.showStaffing as boolean) ?? base.form.services.showStaffing,
      },
    },
    attestations: pickAttestations(raw, base),
    resources: Array.isArray(raw.resources)
      ? raw.resources.map((x) => migrateResource(x as Record<string, unknown>))
      : base.resources,
    origins: {
      VIP: (raw.supportVIP as boolean) ?? base.origins.VIP,
      walkIn: (raw.supportWalkIn as boolean) ?? base.origins.walkIn,
    },
    training: {
      formId:
        (raw.training as { formId?: string } | undefined)?.formId ||
        (raw.safetyTrainingGoogleFormId as string) ||
        base.training?.formId ||
        "",
    },
    supportPA: (raw.supportPA as boolean) ?? base.supportPA,
    supportLiaison: (raw.supportLiaison as boolean) ?? base.supportLiaison,
    resourceName: (raw.resourceName as string) ?? base.resourceName,
    declinedGracePeriod:
      (raw.declinedGracePeriod as number) ?? base.declinedGracePeriod,
    autoCancel: (raw.autoCancel as SchemaContextType["autoCancel"]) ?? base.autoCancel,
    calendarConfig,
    ccEmails: (raw.ccEmails as SchemaContextType["ccEmails"]) ?? base.ccEmails,
    emailNotifications: {
      ...base.emailNotifications,
      ...mapLegacyEmailMessages(raw.emailMessages as Record<string, string> | undefined),
      ...((raw.emailNotifications as EmailNotifications) || {}),
    },
  };

  const legacyTopLevelKeys = new Set([
    "tenantId",
    "tenant",
    "name",
    "logo",
    "nameForPolicy",
    "permissionLabels",
    "policy",
    "programMapping",
    "roleMapping",
    "schoolMapping",
    "roles",
    "showBookingTypes",
    "showNNumber",
    "showSponsor",
    "showCatering",
    "showEquipment",
    "showHireSecurity",
    "showSetup",
    "showStaffing",
    "agreements",
    "attestations",
    "resources",
    "supportVIP",
    "supportWalkIn",
    "training",
    "safetyTrainingGoogleFormId",
    "supportPA",
    "supportLiaison",
    "resourceName",
    "declinedGracePeriod",
    "autoCancel",
    "calendarConfig",
    "ccEmails",
    "emailMessages",
    "emailNotifications",
    "timeSensitiveRequestWarning",
    "mappings",
    "form",
    "origins",
  ]);

  const passthrough = Object.fromEntries(
    Object.entries(raw).filter(([k]) => !legacyTopLevelKeys.has(k)),
  );

  return { ...core, ...passthrough } as SchemaContextType;
}
