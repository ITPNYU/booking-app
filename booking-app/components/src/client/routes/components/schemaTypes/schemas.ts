// Zod definitions for the tenant schema. Types are inferred in `types.ts`.
// Defaults and other runtime helpers live in `helpers.ts`.
//
// Objects are loose: an older Firestore key does not fail validation. Callers
// that save a document write the submitted value, not the parsed clone, so
// unknown keys are kept.

import { defaultSafetyTrainingInfoUrl } from "@/components/src/constants/safetyTraining";
import { z } from "zod";

export const bookingDetailRoleSchema = z.enum([
  "PA",
  "LIAISON",
  "SERVICES",
  "ADMIN",
  "SUPER_ADMIN",
]);

export const showInOriginSchema = z
  .object({
    user: z.boolean().optional(),
    walkIn: z.boolean().optional(),
    VIP: z.boolean().optional(),
  })
  .loose();


export const resourceChartFieldSchema = z
  .object({
    label: z.string().optional(),
    descriptionHtml: z.string().optional(),
    required: z.boolean().optional(),
    /** Reserved for schema authors; forms always apply CHARTFIELD_REGEX when required. */
    validation: z.string().optional(),
  })
  .loose();


export const resourceFormOptionSchema = z
  .object({
    value: z.string().default(""),
    label: z.string().default(""),
    required: z.boolean().optional(),
    descriptionHtml: z.string().optional(),
    chartField: resourceChartFieldSchema.optional(),
    /** Optional Google Calendar ID for auxiliary spaces (filled when calendars exist). */
    calendarId: z.string().optional(),
    /** Production calendar ID for auxiliary spaces. */
    calendarIdProd: z.string().optional(),
    /** @deprecated Use chartField */
    requiresChartField: z.boolean().optional(),
    /** @deprecated */
    defaultValue: z.boolean().optional(),
  })
  .loose();


/**
 * Yes/No switch lock state for a service section.
 * - "on": switch is locked to Yes; the service is always requested and its
 *   dependent fields (chartfield, details) are always shown
 * - "off": switch is locked to No; only the description is shown
 * - "optional" (default when omitted): the user controls the switch
 * Schema locks take precedence over dynamic locks (catering → cleaning,
 * large-event security).
 */
export const serviceToggleSchema = z.enum(["on", "off", "optional"]);


const resourceFormModeSchema = z.enum([
  "radio",
  "select",
  "checkbox",
  "static",
  "hidden",
]);

/**
 * Service section config.
 * - mode "radio" / "select": choice list via options (`select` normalizes to radio on migrate)
 * - mode "checkbox": optional option checkboxes (not forced like radio)
 * - mode "static": read-only HTML
 * - mode "hidden": offered but not shown
 * - omit mode + chartField (no options): yes/no switch
 * - omit mode + description only (no options/chartField/toggle): treated as static on migrate
 * - toggle: lock the yes/no switch (see ServiceToggle). For equipment, omitting
 *   toggle keeps the legacy layout (details field always shown, no switch).
 * - autoCloseout: when the booking reaches Service Closeout (after Cancel or
 *   Check Out), an approved request for this service is closed out by the
 *   system instead of waiting for a service user. Omitted/false keeps the
 *   manual closeout. Any booked room with the flag set closes the service out.
 */
export const resourceFormSectionSchema = z
  .object({
    showInOrigin: showInOriginSchema.optional(),
    label: z.string().optional(),
    descriptionHtml: z.string().optional(),
    mode: resourceFormModeSchema.optional(),
    toggle: serviceToggleSchema.optional(),
    autoCloseout: z.boolean().optional(),
    options: z.array(resourceFormOptionSchema).optional(),
    defaultValue: z.string().optional(),
    required: z.boolean().optional(),
    chartField: resourceChartFieldSchema.optional(),
    forceCleaning: z.boolean().optional(),
    studentLoungeCheckbox: z.boolean().optional(),
    showDetailsField: z.boolean().optional(),
    detailsLabel: z.string().optional(),
    detailsDescriptionHtml: z.string().optional(),
    /** @deprecated Prefer showInOrigin */
    hideForUser: z.boolean().optional(),
    /** @deprecated Prefer showInOrigin */
    hideForVIP: z.boolean().optional(),
    /** @deprecated Prefer showInOrigin */
    hideForWalkIn: z.boolean().optional(),
    enabled: z.boolean().optional(),
  })
  .loose();


export const resourceStaffingServiceOptionSchema = z
  .object({
    value: z.string().default(""),
    label: z.string().default(""),
    defaultValue: z.boolean().optional(),
  })
  .loose();


export const resourceStaffingSectionSchema = z
  .object({
    label: z.string().default(""),
    descriptionHtml: z.string().optional(),
    mode: z.literal("radio").default("radio"),
    defaultValue: z.string().optional(),
    options: z.array(resourceFormOptionSchema).default([]),
    /** @deprecated Prefer label */
    name: z.string().optional(),
    /** @deprecated Prefer options */
    services: z.array(resourceStaffingServiceOptionSchema).optional(),
  })
  .loose();


export const resourceStaffingConfigSchema = z
  .object({
    showInOrigin: showInOriginSchema.optional(),
    label: z.string().optional(),
    descriptionHtml: z.string().optional(),
    /** Lock the staffing yes/no switch (see ServiceToggle). */
    toggle: serviceToggleSchema.optional(),
    /** System closes out an approved staffing request (see ResourceFormSectionConfig). */
    autoCloseout: z.boolean().optional(),
    sections: z.record(z.string(), resourceStaffingSectionSchema).optional(),
    /** @deprecated Prefer sections with options */
    staffingOptions: z.array(resourceStaffingServiceOptionSchema).optional(),
    /** @deprecated Prefer omitting mode (switch) or sections */
    mode: z.enum(["radio", "static", "hidden"]).optional(),
    hideForUser: z.boolean().optional(),
    hideForVIP: z.boolean().optional(),
    hideForWalkIn: z.boolean().optional(),
  })
  .loose();


export const resourceServicesObjectSchema = z
  .object({
    annex: resourceFormSectionSchema.optional(),
    setup: resourceFormSectionSchema.optional(),
    staffing: resourceStaffingConfigSchema.optional(),
    furnishings: resourceFormSectionSchema.optional(),
    equipment: resourceFormSectionSchema.optional(),
    catering: resourceFormSectionSchema.optional(),
    cleaning: resourceFormSectionSchema.optional(),
    security: resourceFormSectionSchema.optional(),
    /** @deprecated Prefer annex */
    auxiliarySpace: resourceFormSectionSchema.optional(),
  })
  .loose();

export const resourceServicesSchema = z.union([
  z.array(z.string()),
  resourceServicesObjectSchema,
]);


export const resourceTrainingSchema = z
  .object({
    required: z.boolean().default(false),
    formId: z.string().default(""),
    infoUrl: z.string().default(defaultSafetyTrainingInfoUrl),
  })
  .loose();


export const requestLimitPeriodSchema = z.enum([
  "perDay",
  "perWeek",
  "perMonth",
  "perSemester",
]);


/** Keys in `resource.requestLimits` — one bucket per base role (VIP / walk-in share the same cap). */
export const requestLimitBucketKeySchema = z.enum([
  "admin",
  "faculty",
  "student",
]);


const requestLimitBucketSchema = z
  .object({
    admin: z.number().default(-1),
    faculty: z.number().default(-1),
    student: z.number().default(-1),
  })
  .loose();

export const requestLimitsSchema = z
  .object({
    perDay: requestLimitBucketSchema.prefault({}),
    perWeek: requestLimitBucketSchema.prefault({}),
    perMonth: requestLimitBucketSchema.prefault({}),
    perSemester: requestLimitBucketSchema.prefault({}),
  })
  .loose();


const approvalHourSchema = z
  .object({
    admin: z.number().default(-1),
    faculty: z.number().default(-1),
    student: z.number().default(-1),
  })
  .loose();

const autoApprovalSchema = z
  .object({
    shouldAutoApprove: z.boolean().default(false),
    minHour: approvalHourSchema.prefault({}),
    maxHour: approvalHourSchema.prefault({}),
    conditions: z
      .object({
        setup: z.boolean().default(false),
        equipment: z.boolean().default(false),
        staffing: z.boolean().default(false),
        catering: z.boolean().default(false),
        cleaning: z.boolean().default(false),
        security: z.boolean().default(false),
        furnishings: z.boolean().default(false),
      })
      .loose()
      .prefault({}),
  })
  .loose();

const originHourSchema = z
  .object({
    student: z.number().default(-1),
    faculty: z.number().default(-1),
    admin: z.number().default(-1),
    studentWalkIn: z.number().default(-1),
    facultyWalkIn: z.number().default(-1),
    adminWalkIn: z.number().default(-1),
    studentVIP: z.number().default(-1),
    facultyVIP: z.number().default(-1),
    adminVIP: z.number().default(-1),
  })
  .loose();

export const staffingSectionSchema = z
  .object({
    name: z.string().default(""),
    indexes: z.array(z.number()).default([]),
  })
  .loose();


/**
 * Room shape. `resourceId` may be empty here so `resourceSchema.parse({})`
 * is the object copied into a new room. A tenant document rejects an empty id.
 */
export const resourceSchema = z
  .object({
    capacity: z.number().default(0),
    name: z.string().default(""),
    resourceId: z.string().default(""),
    /**
     * When set, this resource is an auxiliary (annex) space belonging to the
     * parent resource. Annex resources are hidden from the top-level room list,
     * cannot be booked standalone, and are offered as annex checkboxes under
     * their parent; selecting one invites its calendar to the parent's event.
     */
    parentResourceId: z.string().optional(),
    isEquipment: z.boolean().default(false),
    calendarId: z.string().default(""),
    training: resourceTrainingSchema.prefault({}),
    isWalkIn: z.boolean().default(false),
    isWalkInCanBookTwo: z.boolean().default(false),
    /** Consolidated service config; legacy string[] coerced on read */
    services: resourceServicesSchema.prefault({}),
    /**
     * Limit how many requests a user can make per period for this resource.
     * Convention: `-1` (or missing) means “unlimited”.
     *
     * Shape: each period has only `admin`, `faculty`, `student` — counts include all booking origins.
     */
    requestLimits: requestLimitsSchema.prefault({}),
    autoApproval: autoApprovalSchema.prefault({}),
    maxHour: originHourSchema.prefault({}),
    minHour: originHourSchema.prefault({}),
    staffingServices: z.array(z.string()).default([]),
    staffingSections: z.array(staffingSectionSchema).default([]),
    calendarIdProd: z.string().default(""),
  })
  .loose();


function resourceIdIssue(resourceId: string): string | null {
  const id = resourceId.trim();
  if (!id) return "Resource id is required";
  if (id.includes(",")) return "Resource id must not contain commas";
  return null;
}

/** One stored room: the resource shape, plus a non-empty id with no commas. */
export const tenantResourceSchema = resourceSchema.superRefine((resource, ctx) => {
  const message = resourceIdIssue(resource.resourceId);
  if (!message) return;
  ctx.addIssue({
    code: "custom",
    message,
    path: ["resourceId"],
  });
});

/** Rooms on a tenant document. Ids are non-empty, comma-free, and unique. */
export const resourcesArraySchema = z
  .array(resourceSchema)
  .superRefine((resources, ctx) => {
    const seen = new Set<string>();
    resources.forEach((resource, index) => {
      const message = resourceIdIssue(resource.resourceId);
      if (message) {
        ctx.addIssue({
          code: "custom",
          message,
          path: [index, "resourceId"],
        });
        return;
      }
      const id = resource.resourceId.trim();
      if (seen.has(id)) {
        ctx.addIssue({
          code: "custom",
          message: `Resource id "${id}" is already in the schema`,
          path: [index, "resourceId"],
        });
        return;
      }
      seen.add(id);
    });
  });

export const attestationSchema = z
  .object({
    id: z.string().default(""),
    html: z.string().default(""),
  })
  .loose();


export const timeSensitiveRequestWarningSchema = z
  .object({
    hours: z.number().default(48),
    isActive: z.boolean().default(false),
    message: z.string().default(""),
    policyLink: z.string().default(""),
  })
  .loose();


export const termRangeSchema = z.tuple([z.number(), z.number()]);


export const termConfigSchema = z
  .object({
    fallTerm: termRangeSchema.default([9, 12]),
    springTerm: termRangeSchema.default([1, 5]),
    summerTerm: termRangeSchema.default([6, 8]),
  })
  .loose();


export const contextLabelsSchema = z
  .object({
    user: z.string().default("User"),
    worker: z.string().default("PA"),
    reviewer: z.string().default("Liaison"),
    services: z.string().default("Services"),
    admin: z.string().default("Admin"),
  })
  .loose();


export const tenantBrandingSchema = z
  .object({
    name: z.string().default(""),
    logo: z.string().default(""),
    nameForPolicy: z.string().default(""),
    contextLabels: contextLabelsSchema.prefault({}),
  })
  .loose();


export const formServicesSchema = z
  .object({
    showCatering: z.boolean().default(true),
    showEquipment: z.boolean().default(true),
    showSecurity: z.boolean().default(true),
    showSetup: z.boolean().default(true),
    showStaffing: z.boolean().default(true),
  })
  .loose();


export const formAlertSeveritySchema = z.enum([
  "success",
  "info",
  "warning",
  "error",
]);


export const formAlertWhenSchema = z
  .object({
    autoApproval: z.enum(["eligible", "ineligible"]).optional(),
  })
  .loose();


export const formAlertSchema = z
  .object({
    id: z.string(),
    /** Omit to show for every origin. A missing key means show. */
    showInOrigin: showInOriginSchema.optional(),
    /** All keys must match. Omit for an always-on notice. */
    when: formAlertWhenSchema.optional(),
    slot: z.enum(["status", "notice"]),
    severity: formAlertSeveritySchema,
    message: z.string(),
  })
  .loose();


const defaultFormAlerts: z.infer<typeof formAlertSchema>[] = [
  {
    id: "autoApprovalEligible",
    slot: "status",
    showInOrigin: { user: true, VIP: true, walkIn: true },
    when: { autoApproval: "eligible" },
    severity: "success",
    message: "Yay! This request is eligible for automatic approval",
  },
  {
    id: "needsApproval",
    slot: "status",
    showInOrigin: { user: true, VIP: true, walkIn: true },
    when: { autoApproval: "ineligible" },
    severity: "warning",
    message: "This request will require approval.",
  },
  {
    id: "setupBreakdown",
    slot: "notice",
    showInOrigin: { user: true, VIP: true, walkIn: true },
    severity: "warning",
    message:
      "Please include all setup and breakdown time in your reservation request.",
  },
];

/** Duration-gated free-text field on the Details step (issue #1126). */
export const productionScheduleSchema = z
  .object({
    enabled: z.boolean().default(false),
    /** Required when reservation length (hours) is strictly greater than this. */
    requiredAboveHours: z.number().default(4),
    label: z.string().default("Production Schedule"),
    description: z
      .string()
      .default(
        "Please provide a production schedule for your reservation. This is required to justify reservations longer than 4 hours. It should minimally include setup, production, and breakdown.",
      ),
    templateLink: z
      .string()
      .default(
        "https://docs.google.com/document/d/1RzBf0mlWiYHrWpfIvh7qS5zKnmTn3SHSr7xVTQaOoz0/edit?usp=sharing",
      ),
    templateLinkText: z
      .string()
      .default(
        "Click here for schedule templates for events, recording sessions, and other productions",
      ),
    calendarBannerMessage: z
      .string()
      .default(
        "This request is greater than four hours. You will need to provide a production schedule on the next page to continue.",
      ),
  })
  .loose();


export const formConfigSchema = z
  .object({
    showBookingType: z.boolean().default(true),
    showNNumber: z.boolean().default(true),
    showSponsor: z.boolean().default(true),
    services: formServicesSchema.prefault({}),
    /** Omitted on older documents; code defaults preserve the previous banners. */
    alerts: z.array(formAlertSchema).default(defaultFormAlerts),
    productionSchedule: productionScheduleSchema.prefault({}),
  })
  .loose();


const roleListSchema = z.array(bookingDetailRoleSchema);

export const detailsModalSchema = z
  .object({
    /** Show the WebCheckout section and the cart number in the bookings table. */
    showWebCheckout: z.boolean().default(true),
    /**
     * Roles that can see the WebCheckout section. Roles in
     * `webCheckoutEditRoles` can always see it too. Scoped to page contexts the
     * same way as `memoViewRoles`. On My Bookings the requester still sees an
     * assigned cart read-only while `showWebCheckout` is on.
     */
    webCheckoutViewRoles: roleListSchema.default(["PA", "ADMIN", "SUPER_ADMIN"]),
    /**
     * Roles that can edit the cart number, scoped to page contexts the same way
     * as `memoEditRoles`. `POST /api/updateWebcheckoutCart` enforces the same
     * list.
     */
    webCheckoutEditRoles: roleListSchema.default(["PA", "ADMIN", "SUPER_ADMIN"]),
    /**
     * Show the staff-only Memo section under WebCheckout, used to record e.g.
     * work order confirmation numbers.
     */
    showMemo: z.boolean().default(false),
    /**
     * Roles that can read the Memo. Roles in `memoEditRoles` can always read it
     * too. A role also unlocks its own page context (PA page, Liaison page,
     * Services page, Admin page; SUPER_ADMIN uses the Admin page). The Firestore
     * read routes enforce the same list.
     */
    memoViewRoles: roleListSchema.default(["SERVICES", "ADMIN", "SUPER_ADMIN"]),
    /**
     * Roles that can edit the Memo, scoped to page contexts the same way as
     * `memoViewRoles`. `PUT /api/bookings/memo` enforces the same list.
     */
    memoEditRoles: roleListSchema.default(["SERVICES", "ADMIN", "SUPER_ADMIN"]),
  })
  .loose();


export const originsSchema = z
  .object({
    VIP: z.boolean().default(false),
    walkIn: z.boolean().default(false),
  })
  .loose();


const stringListRecordSchema = z.record(z.string(), z.array(z.string()));

export const mappingsSchema = z
  .object({
    program: stringListRecordSchema.prefault({}),
    role: stringListRecordSchema.prefault({}),
    school: stringListRecordSchema.prefault({}),
  })
  .loose();


export const trainingConfigSchema = z
  .object({
    formId: z.string().default(""),
  })
  .loose();


export const emailNotificationsSchema = z
  .object({
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
  })
  .loose();


const emailEnvironmentSchema = z
  .object({
    development: z.string().default(""),
    staging: z.string().default(""),
    production: z.string().default(""),
  })
  .loose();

const ccEmailsSchema = z
  .object({
    approved: emailEnvironmentSchema.prefault({}),
    canceled: emailEnvironmentSchema.prefault({}),
    /**
     * Gets a copy of the requester's decline email. Each value may list
     * several addresses separated by commas or semicolons; empty sends none.
     */
    declined: emailEnvironmentSchema.prefault({}),
  })
  .loose();

const START_HOURS: Record<string, string> = {
  student: "09:00:00",
  studentVIP: "06:00:00",
  studentWalkIn: "09:00:00",
  faculty: "09:00:00",
  facultyVIP: "06:00:00",
  facultyWalkIn: "09:00:00",
  admin: "09:00:00",
  adminVIP: "06:00:00",
  adminWalkIn: "09:00:00",
};

const SLOT_UNITS: Record<string, number> = {
  student: 15,
  studentVIP: 15,
  studentWalkIn: 15,
  faculty: 15,
  facultyVIP: 15,
  facultyWalkIn: 15,
  admin: 15,
  adminVIP: 15,
  adminWalkIn: 15,
};

const calendarConfigSchema = z
  .object({
    startHour: z.record(z.string(), z.string()).default(START_HOURS),
    slotUnit: z.record(z.string(), z.number()).default(SLOT_UNITS),
    multipleResourceSelect: z.boolean().default(false),
    timeSensitiveRequestWarning: timeSensitiveRequestWarningSchema.prefault({}),
  })
  .loose();

const autoCancelSchema = z.union([
  z.literal(false),
  z
    .object({
      minutesPriorToStart: z.number(),
      conditions: z
        .object({
          requested: z.boolean(),
          preApproved: z.boolean(),
        })
        .loose(),
    })
    .loose(),
]);

export const APPROVAL_EVENTS = [
  "approve",
  "decline",
  "cancel",
  "edit",
  "checkIn",
  "checkOut",
  "noShow",
  "approveStaff",
  "declineStaff",
  "closeoutStaff",
  "approveCatering",
  "declineCatering",
  "closeoutCatering",
  "approveSetup",
  "declineSetup",
  "closeoutSetup",
  "approveCleaning",
  "declineCleaning",
  "closeoutCleaning",
  "approveSecurity",
  "declineSecurity",
  "closeoutSecurity",
  "approveEquipment",
  "declineEquipment",
  "closeoutEquipment",
  "approveFurnishings",
  "declineFurnishings",
  "closeoutFurnishings",
] as const;

export const APPROVAL_GUARDS = [
  "shouldAutoApprove",
  "servicesRequested",
  "isVip",
] as const;

export const APPROVAL_EFFECTS = [
  "sendHTMLEmail",
  "createCalendarEvent",
  "updateCalendarEvent",
  "queueCancelProcessing",
] as const;

export const approvalEventSchema = z.enum(APPROVAL_EVENTS);
export const approvalGuardSchema = z.enum(APPROVAL_GUARDS);
export const approvalEffectSchema = z.enum(APPROVAL_EFFECTS);

const approvalTransitionSchema = z
  .object({
    target: z.string().min(1),
    guard: approvalGuardSchema.optional(),
  })
  .loose();

const approvalAfterSchema = z
  .object({
    delayMs: z.number().int().nonnegative(),
    target: z.string().min(1),
  })
  .loose();

export const approvalStateSchema = z
  .object({
    initial: z.string().min(1).optional(),
    get states() {
      return z.record(z.string(), approvalStateSchema).optional();
    },
    type: z.enum(["parallel", "final"]).optional(),
    on: z.partialRecord(approvalEventSchema, approvalTransitionSchema).optional(),
    always: z.array(approvalTransitionSchema).optional(),
    entry: z.array(approvalEffectSchema).optional(),
    after: z.array(approvalAfterSchema).optional(),
  })
  .loose();

type ApprovalStateNode = {
  initial?: string;
  states?: Record<string, ApprovalStateNode>;
  type?: "parallel" | "final";
  on?: Record<string, { target?: string } | undefined>;
  always?: { target?: string }[];
  after?: { target?: string }[];
};

type ApprovalIssueCtx = {
  addIssue: (issue: {
    code: "custom";
    message: string;
    path: (string | number)[];
  }) => void;
};

function refineApprovalStates(
  states: Record<string, ApprovalStateNode>,
  ctx: ApprovalIssueCtx,
  path: (string | number)[],
) {
  const names = new Set(Object.keys(states));
  for (const [name, state] of Object.entries(states)) {
    const statePath = [...path, name];
    if (state.initial !== undefined) {
      const children = state.states ?? {};
      if (!(state.initial in children)) {
        ctx.addIssue({
          code: "custom",
          message: `initial "${state.initial}" is not a state`,
          path: [...statePath, "initial"],
        });
      }
    }
    const checkTarget = (
      target: string | undefined,
      targetPath: (string | number)[],
    ) => {
      if (!target || names.has(target)) return;
      ctx.addIssue({
        code: "custom",
        message: `target "${target}" is not a state`,
        path: targetPath,
      });
    };
    for (const [event, transition] of Object.entries(state.on ?? {})) {
      checkTarget(transition?.target, [...statePath, "on", event, "target"]);
    }
    state.always?.forEach((transition, index) => {
      checkTarget(transition?.target, [...statePath, "always", index, "target"]);
    });
    state.after?.forEach((transition, index) => {
      checkTarget(transition?.target, [...statePath, "after", index, "target"]);
    });
    if (state.states) {
      refineApprovalStates(state.states, ctx, [...statePath, "states"]);
    }
  }
}

export const approvalFlowSchema = z
  .object({
    version: z.number().int().positive(),
    initial: z.string().min(1),
    states: z.record(z.string(), approvalStateSchema),
  })
  .loose()
  .superRefine((flow, ctx) => {
    const states = flow.states as Record<string, ApprovalStateNode>;
    if (!(flow.initial in states)) {
      ctx.addIssue({
        code: "custom",
        message: `initial "${flow.initial}" is not a state`,
        path: ["initial"],
      });
    }
    refineApprovalStates(states, ctx, ["states"]);
  });

export const tenantSchema = z
  .object({
    /** Tenant slug / document id (e.g. mc, itp) */
    tenantId: z.string(),
    tenant: tenantBrandingSchema.prefault({}),
    policy: z.string().default(""),
    mappings: mappingsSchema.prefault({}),
    roles: z.array(z.string()).default([]),
    form: formConfigSchema.prefault({}),
    detailsModal: detailsModalSchema.prefault({}),
    attestations: z.array(attestationSchema).default([]),
    resources: resourcesArraySchema.default([]),
    origins: originsSchema.prefault({}),
    training: trainingConfigSchema.prefault({}),
    supportPA: z.boolean().default(false),
    supportLiaison: z.boolean().default(false),
    resourceName: z.string().default(""),
    declinedGracePeriod: z.number().default(24),
    /** Hours pending before interim column text is emphasized on the admin bookings dashboard (default 18) */
    interimHighlightThresholdHours: z.number().default(18),
    /**
     * When enabled, automatically cancel requests within a time window prior to start time
     * if they are still unapproved (Requested / Pre-approved depending on conditions).
     *
     * Stored as `false` by default for backwards compatibility with older schemas.
     */
    autoCancel: autoCancelSchema.default(false),
    /** Term/semester configuration for "perSemester" request limits */
    termConfig: termConfigSchema.prefault({}),
    calendarConfig: calendarConfigSchema.prefault({}),
    ccEmails: ccEmailsSchema.prefault({}),
    emailNotifications: emailNotificationsSchema.prefault({}),
    /**
     * Optional booking graph. Absent means this tenant keeps its hardcoded
     * machine. Not a default: parsing a document must not invent a flow.
     */
    approvalFlow: approvalFlowSchema.optional(),
  })
  .loose();
