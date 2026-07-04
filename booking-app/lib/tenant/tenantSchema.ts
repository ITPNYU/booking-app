// Single-source-of-truth tenant schema, expressed with Zod.
//
// The tenant schema's TYPE, DEFAULTS, and COERCION are currently maintained in
// three separate hand-written places (`schemaTypes.ts`, `generateDefaultSchema`,
// `coerceTenantSchema`) that drift. This module encodes all three once:
//   - the type   → `z.infer<ReturnType<typeof makeTenantSchema>>`
//   - defaults   → `makeTenantSchema(tenant).parse({})`
//   - coercion   → `makeTenantSchema(tenant).parse(rawDoc)`
//
// Phase 0: this schema is introduced ALONGSIDE the existing code and asserted at
// parity in tests. It is not yet wired into any read path.
//
// Zod 4 notes: `.default(v)` returns `v` without re-parsing, so nested objects
// whose sub-defaults must cascade use `.prefault({})` (parse the empty object so
// each field applies its own default). `z.looseObject` keeps unknown keys (the
// DB may hold fields the code does not model yet), matching the `...raw` /
// `...resource` passthrough in the current coerce.

import { z } from "zod";

import { defaultSafetyTrainingInfoUrl } from "@/components/src/constants/safetyTraining";

// ── leaves ────────────────────────────────────────────────────────────────
const HOUR_KEYS = [
  "student",
  "faculty",
  "admin",
  "studentWalkIn",
  "facultyWalkIn",
  "adminWalkIn",
  "studentVIP",
  "facultyVIP",
  "adminVIP",
] as const;

const HourMap = z.object(
  Object.fromEntries(HOUR_KEYS.map((k) => [k, z.number().default(-1)])),
);

const BaseRoleMap = z.object({
  admin: z.number().default(-1),
  faculty: z.number().default(-1),
  student: z.number().default(-1),
});

const RequestLimits = z.object({
  perDay: BaseRoleMap.prefault({}),
  perWeek: BaseRoleMap.prefault({}),
  perMonth: BaseRoleMap.prefault({}),
  perSemester: BaseRoleMap.prefault({}),
});

const ResourceTraining = z.object({
  required: z.boolean().default(false),
  formId: z.string().default(""),
  infoUrl: z.string().default(defaultSafetyTrainingInfoUrl),
});

const StaffingSection = z.object({
  name: z.string().default(""),
  indexes: z.array(z.number()).default([]),
});

const AutoApproval = z.object({
  shouldAutoApprove: z.boolean().default(false),
  minHour: BaseRoleMap.prefault({}),
  maxHour: BaseRoleMap.prefault({}),
  conditions: z
    .object({
      setup: z.boolean().default(false),
      equipment: z.boolean().default(false),
      staffing: z.boolean().default(false),
      catering: z.boolean().default(false),
      cleaning: z.boolean().default(false),
      security: z.boolean().default(false),
    })
    .prefault({}),
});

// Legacy roomId→resourceId normalization + validation, matching coerceResource /
// normalizeResourceId in lib/tenant/coerceTenantSchema.ts.
function normalizeResourceId(value: unknown, field: string): string {
  if (
    (typeof value !== "string" && typeof value !== "number") ||
    (typeof value === "number" && !Number.isFinite(value))
  ) {
    throw new Error(`${field} must be a string or finite number`);
  }
  const id = String(value);
  if (!id.trim()) throw new Error(`${field} must be non-empty`);
  if (id.includes(",")) throw new Error(`${field} must not contain commas`);
  return id;
}

const Resource = z.preprocess((raw) => {
  if (!raw || typeof raw !== "object") return raw;
  const { roomId, resourceId, ...rest } = raw as Record<string, unknown>;
  const canonical =
    resourceId === undefined
      ? normalizeResourceId(roomId, "resourceId")
      : normalizeResourceId(resourceId, "resourceId");
  if (
    roomId !== undefined &&
    normalizeResourceId(roomId, "roomId") !== canonical
  ) {
    throw new Error("resource has conflicting resourceId and roomId");
  }
  return { ...rest, resourceId: canonical };
}, z.looseObject({
  resourceId: z.string(),
  capacity: z.number().default(0),
  name: z.string().default(""),
  isEquipment: z.boolean().default(false),
  calendarId: z.string().default(""),
  training: ResourceTraining.prefault({}),
  isWalkIn: z.boolean().default(false),
  isWalkInCanBookTwo: z.boolean().default(false),
  services: z.array(z.string()).default([]),
  requestLimits: RequestLimits.prefault({}),
  autoApproval: AutoApproval.prefault({}),
  maxHour: HourMap.prefault({}),
  minHour: HourMap.prefault({}),
  staffingServices: z.array(z.string()).default([]),
  staffingSections: z.array(StaffingSection).default([]),
  calendarIdProd: z.string().default(""),
}));

const Attestation = z.object({
  id: z.string().default(""),
  html: z.string().default(""),
});

const ContextLabels = z.object({
  user: z.string().default("User"),
  worker: z.string().default("PA"),
  reviewer: z.string().default("Liaison"),
  services: z.string().default("Services"),
  admin: z.string().default("Admin"),
});

function contextLabelsFor(tenantId: string) {
  return (tenantId || "").toLowerCase() === "itp"
    ? {
        user: "User",
        worker: "ER",
        reviewer: "1st Approver",
        services: "Services",
        admin: "Admin",
      }
    : {
        user: "User",
        worker: "PA",
        reviewer: "Liaison",
        services: "Services",
        admin: "Admin",
      };
}

const FormServices = z.object({
  showCatering: z.boolean().default(true),
  showEquipment: z.boolean().default(true),
  showSecurity: z.boolean().default(true),
  showSetup: z.boolean().default(true),
  showStaffing: z.boolean().default(true),
});

const Form = z.object({
  showBookingType: z.boolean().default(true),
  showNNumber: z.boolean().default(true),
  showSponsor: z.boolean().default(true),
  services: FormServices.prefault({}),
});

const Mappings = z.object({
  program: z.record(z.string(), z.array(z.string())).default({}),
  role: z.record(z.string(), z.array(z.string())).default({}),
  school: z.record(z.string(), z.array(z.string())).default({}),
});

const Origins = z.object({
  VIP: z.boolean().default(false),
  walkIn: z.boolean().default(false),
});

const EmailNotifications = z.object({
  requestedUser: z.string().default(""),
  requestedNeedsApproval: z.string().default(""),
  reviewedNeedsApproval: z.string().default(""),
  approvedWalkIn: z.string().default(""),
  approvedVIP: z.string().default(""),
  checkedOut: z.string().default(""),
  checkedIn: z.string().default(""),
  declined: z.string().default(""),
  canceled: z.string().default(""),
  canceledLate: z.string().default(""),
  noShow: z.string().default(""),
  closed: z.string().default(""),
  approvedUser: z.string().default(""),
});

const TimeSensitiveRequestWarning = z.object({
  hours: z.number().default(48),
  isActive: z.boolean().default(false),
  message: z.string().default(""),
  policyLink: z.string().default(""),
});

const CalendarConfig = z.object({
  startHour: z.record(z.string(), z.string()).default({
    student: "09:00:00",
    studentVIP: "06:00:00",
    studentWalkIn: "09:00:00",
    faculty: "09:00:00",
    facultyVIP: "06:00:00",
    facultyWalkIn: "09:00:00",
    admin: "09:00:00",
    adminVIP: "06:00:00",
    adminWalkIn: "09:00:00",
  }),
  slotUnit: z.record(z.string(), z.number()).default({
    student: 15,
    studentVIP: 15,
    studentWalkIn: 15,
    faculty: 15,
    facultyVIP: 15,
    facultyWalkIn: 15,
    admin: 15,
    adminVIP: 15,
    adminWalkIn: 15,
  }),
  multipleResourceSelect: z.boolean().default(false),
  timeSensitiveRequestWarning: TimeSensitiveRequestWarning.prefault({}),
});

const CcEmailEnvs = z.object({
  development: z.string().default(""),
  staging: z.string().default(""),
  production: z.string().default(""),
});

const AutoCancel = z.union([
  z.literal(false),
  z.object({
    minutesPriorToStart: z.number(),
    conditions: z.object({
      requested: z.boolean(),
      preApproved: z.boolean(),
    }),
  }),
]);

const Term = z.tuple([z.number(), z.number()]);

/**
 * Build the tenant-schema validator for a given tenant. The tenant id determines
 * the per-tenant `contextLabels` default (itp uses ER / 1st Approver).
 */
export function makeTenantSchema(tenantId: string) {
  const Tenant = z.object({
    name: z.string().default(""),
    logo: z.string().default(""),
    nameForPolicy: z.string().default(""),
    contextLabels: ContextLabels.prefault(contextLabelsFor(tenantId)),
  });

  const Doc = z.looseObject({
    tenantId: z.string().default(tenantId),
    tenant: Tenant.prefault({}),
    policy: z.string().default(""),
    mappings: Mappings.prefault({}),
    roles: z.array(z.string()).default([]),
    form: Form.prefault({}),
    attestations: z.array(Attestation).default([]),
    resources: z
      .array(Resource)
      .default([])
      .superRefine((resources, ctx) => {
        const seen = new Set<string>();
        for (const r of resources as Array<{ resourceId: string }>) {
          if (seen.has(r.resourceId)) {
            ctx.addIssue({
              code: "custom",
              message: `resources has duplicate resourceId "${r.resourceId}"`,
            });
          }
          seen.add(r.resourceId);
        }
      }),
    origins: Origins.prefault({}),
    training: z.object({ formId: z.string().default("") }).prefault({}),
    supportPA: z.boolean().default(false),
    supportLiaison: z.boolean().default(false),
    resourceName: z.string().default(""),
    declinedGracePeriod: z.number().default(24),
    interimHighlightThresholdHours: z.number().default(18),
    autoCancel: AutoCancel.default(false),
    termConfig: z
      .object({
        fallTerm: Term.default([9, 12]),
        springTerm: Term.default([1, 5]),
        summerTerm: Term.default([6, 8]),
      })
      .prefault({}),
    calendarConfig: CalendarConfig.prefault({}),
    ccEmails: z
      .object({
        approved: CcEmailEnvs.prefault({}),
        canceled: CcEmailEnvs.prefault({}),
      })
      .prefault({}),
    emailNotifications: EmailNotifications.prefault({}),
  });

  // Override tenantId with the URL tenant (coerceTenantSchema does the same:
  // `raw.tenantId || tenantSlug`, but we treat the URL as authoritative).
  return z.preprocess((raw) => {
    const r =
      raw && typeof raw === "object"
        ? { ...(raw as Record<string, unknown>) }
        : {};
    if (!r.tenantId) r.tenantId = tenantId;
    return r;
  }, Doc);
}

export type TenantSchema = z.infer<ReturnType<typeof makeTenantSchema>>;
