import { compareResourceIds } from "./resourceOrder";
import {
  type ServiceResourceLike,
  getAnnexChildResources,
  getServiceResourceId,
  isLegacyServicesArray,
} from "./resourceServicesUtils";

// Same as normalizeApproverEmail in policy.ts, which this module can't import
// without a cycle through the client Firestore helpers.
const normalizeApproverEmail = (email: string): string =>
  email.trim().toLowerCase();

/** Services that have their own approvers, keyed as on the booking and in the machine. */
export const APPROVER_SERVICES = [
  "setup",
  "furnishings",
  "equipment",
  "staff",
  "catering",
  "cleaning",
  "security",
] as const;

export type ApproverService = (typeof APPROVER_SERVICES)[number];

export const isApproverService = (value: unknown): value is ApproverService =>
  typeof value === "string" &&
  (APPROVER_SERVICES as readonly string[]).includes(value);

/**
 * Tenant-wide service approvers from before per-resource assignments: the
 * `usersRights` flag each service maps to. Furnishings used to be folded into
 * setup, so until a tenant has an isFurnishings approver its setup approvers
 * stand in.
 */
export const LEGACY_SERVICE_APPROVER_FLAGS: Record<
  ApproverService,
  { flag: string; fallbackFlag?: string }
> = {
  setup: { flag: "isSetup" },
  furnishings: { flag: "isFurnishings", fallbackFlag: "isSetup" },
  equipment: { flag: "isEquipment" },
  staff: { flag: "isStaffing" },
  catering: { flag: "isCatering" },
  cleaning: { flag: "isCleaning" },
  security: { flag: "isSecurity" },
};

/** Whether a `usersRights` record carries any tenant-wide service approver flag. */
export const hasLegacyServiceApproverFlag = (
  userRights: Record<string, unknown> | null | undefined,
): boolean =>
  Object.values(LEGACY_SERVICE_APPROVER_FLAGS).some(
    ({ flag }) => userRights?.[flag] === true,
  );

/**
 * One `{tenant}-usersApproversResources` document: who approves one resource.
 * `serviceApproverEmails` is every email in `serviceApprovers`, rewritten on
 * each change so a single array-contains query can tell whether a person
 * approves any service anywhere.
 */
export type ApproversResource = {
  resourceId: string;
  resourceApprovers: string[];
  serviceApprovers: Partial<Record<ApproverService, string[]>>;
  serviceApproverEmails: string[];
};

/** Doc ID of a resource's `usersApproversResources` entry: the resource ID itself. */
export const getApproversResourceDocumentId = (resourceId: string): string =>
  encodeURIComponent(resourceId.trim());

export type ApproverChange = {
  action: "add" | "remove";
  email: string;
} & ({ kind: "resource" } | { kind: "service"; service: ApproverService });

export const normalizeApproverEmails = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  const emails = value
    .filter((email): email is string => typeof email === "string")
    .map(normalizeApproverEmail)
    .filter(Boolean);
  return [...new Set(emails)];
};

export const collectServiceApproverEmails = (
  serviceApprovers: ApproversResource["serviceApprovers"],
): string[] => [
  ...new Set(
    APPROVER_SERVICES.flatMap((service) => serviceApprovers[service] ?? []),
  ),
];

/** Read a stored document defensively; unknown services and bad emails are dropped. */
export const toApproversResource = (
  resourceId: string,
  data: Record<string, unknown> | undefined,
): ApproversResource => {
  const rawServiceApprovers =
    data?.serviceApprovers && typeof data.serviceApprovers === "object"
      ? (data.serviceApprovers as Record<string, unknown>)
      : {};
  const serviceApprovers: ApproversResource["serviceApprovers"] = {};
  for (const service of APPROVER_SERVICES) {
    const emails = normalizeApproverEmails(rawServiceApprovers[service]);
    if (emails.length > 0) serviceApprovers[service] = emails;
  }
  return {
    resourceId: resourceId.trim(),
    resourceApprovers: normalizeApproverEmails(data?.resourceApprovers),
    serviceApprovers,
    serviceApproverEmails: collectServiceApproverEmails(serviceApprovers),
  };
};

export const applyApproverChange = (
  current: ApproversResource,
  change: ApproverChange,
): ApproversResource => {
  const email = normalizeApproverEmail(change.email);
  const update = (emails: string[]) =>
    change.action === "add"
      ? [...new Set([...emails, email])]
      : emails.filter((existing) => existing !== email);

  if (change.kind === "resource") {
    return {
      ...current,
      resourceApprovers: update(current.resourceApprovers),
    };
  }
  const serviceApprovers = {
    ...current.serviceApprovers,
    [change.service]: update(current.serviceApprovers[change.service] ?? []),
  };
  return {
    ...current,
    serviceApprovers,
    serviceApproverEmails: collectServiceApproverEmails(serviceApprovers),
  };
};

export const parseBookingResourceIds = (roomId: unknown): string[] => [
  ...new Set(
    String(roomId ?? "")
      .split(",")
      .map((resourceId) => resourceId.trim())
      .filter(Boolean),
  ),
];

const SERVICE_NAME_ALIASES: Record<string, ApproverService> = {
  staffing: "staff",
  cleanup: "cleaning",
};

/** A service name as stored in schemas and older approver docs, as an approver service key. */
export const toApproverService = (name: string): ApproverService | null => {
  const key = name.trim().toLowerCase();
  const service = SERVICE_NAME_ALIASES[key] ?? key;
  return isApproverService(service) ? service : null;
};

const ownApproverServices = (
  resource: ServiceResourceLike,
): ApproverService[] => {
  const { services } = resource;
  const names = isLegacyServicesArray(services)
    ? services
    : Object.entries(services ?? {})
        .filter(([, config]) => config != null)
        .map(([name]) => name);
  return names
    .map(toApproverService)
    .filter((service): service is ApproverService => service !== null);
};

/**
 * Services a resource offers that can have approvers, its annex spaces
 * included: an annex space is booked under its parent room, so the parent
 * room's approvers handle the annex's services too.
 */
export const getResourceApproverServices = (
  resource: ServiceResourceLike,
  allResources: ServiceResourceLike[],
): ApproverService[] => {
  const offered = new Set([
    ...ownApproverServices(resource),
    ...getAnnexChildResources(resource, allResources).flatMap(
      ownApproverServices,
    ),
  ]);
  return APPROVER_SERVICES.filter((service) => offered.has(service));
};

/** Resources that get their own approvers: rooms, not the annex spaces under them. */
export const getApproverResources = <T extends ServiceResourceLike>(
  resources: T[],
): T[] =>
  resources
    .filter((resource) => !resource.parentResourceId)
    .sort((a, b) =>
      compareResourceIds(getServiceResourceId(a), getServiceResourceId(b)),
    );

/**
 * The booking's rooms whose approvers handle `service`: the rooms that offer
 * it. A room missing from the tenant schema can't be ruled out, so it stays
 * in; when no room offers the service, every room does.
 */
export const getServiceApproverResourceIds = (
  roomId: unknown,
  service: ApproverService,
  resources: ServiceResourceLike[],
): string[] => {
  const resourceIds = parseBookingResourceIds(roomId);
  const offering = resourceIds.filter((resourceId) => {
    const resource = resources.find(
      (candidate) => getServiceResourceId(candidate) === resourceId,
    );
    return (
      !resource ||
      getResourceApproverServices(resource, resources).includes(service)
    );
  });
  return offering.length > 0 ? offering : resourceIds;
};

/**
 * The union of each resource's own approvers. A booking has one approval and
 * one decision per service, so an approver of any of its resources may act;
 * `uncovered` lists the resources with no approvers of their own, which the
 * caller covers with its fallback.
 */
export const unionResourceApprovers = (
  resourceIds: string[],
  approversFor: (resourceId: string) => string[],
): { approvers: string[]; uncovered: string[] } => {
  const approvers = new Set<string>();
  const uncovered: string[] = [];
  for (const resourceId of resourceIds) {
    const own = approversFor(resourceId);
    if (own.length === 0) uncovered.push(resourceId);
    own.forEach((email) => approvers.add(email));
  }
  return { approvers: [...approvers], uncovered };
};
