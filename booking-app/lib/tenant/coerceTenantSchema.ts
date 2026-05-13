import type {
  EmailNotifications,
  Resource,
  SchemaContextType,
  TimeSensitiveRequestWarning,
} from "@/components/src/client/routes/components/SchemaProvider";
import { generateDefaultSchema } from "@/components/src/client/routes/components/SchemaProvider";

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

function migrateResource(r: Record<string, unknown>): Resource {
  const hasLegacyTraining =
    r.needsSafetyTraining !== undefined ||
    r.trainingFormUrl !== undefined ||
    r.trainingInfoUrl !== undefined;

  const training: Resource["training"] =
    (r.training as Resource["training"]) ||
    (hasLegacyTraining
      ? {
          required: Boolean(r.needsSafetyTraining),
          formId: (r.trainingFormUrl as string) || "",
          infoUrl: (r.trainingInfoUrl as string) || "",
        }
      : { required: false, formId: "", infoUrl: "" });

  const {
    needsSafetyTraining: _n,
    trainingFormUrl: _f,
    trainingInfoUrl: _i,
    ...rest
  } = r;

  return { ...rest, training } as Resource;
}

function isNewSchemaShape(raw: Record<string, unknown>): boolean {
  return Boolean(
    raw.mappings &&
      typeof raw.mappings === "object" &&
      !Array.isArray(raw.mappings) &&
      raw.form &&
      typeof raw.form === "object" &&
      !Array.isArray(raw.form) &&
      raw.tenant &&
      typeof raw.tenant === "object" &&
      !Array.isArray(raw.tenant) &&
      "contextLabels" in (raw.tenant as object),
  );
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
        ? raw.resources.map((x) => migrateResource(x as Record<string, unknown>))
        : base.resources,
      attestations: Array.isArray(raw.attestations)
        ? (raw.attestations as SchemaContextType["attestations"])
        : base.attestations,
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
    attestations: Array.isArray(raw.attestations)
      ? (raw.attestations as SchemaContextType["attestations"])
      : Array.isArray(raw.agreements)
        ? (raw.agreements as SchemaContextType["attestations"])
        : base.attestations,
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
