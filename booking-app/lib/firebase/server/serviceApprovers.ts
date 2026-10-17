import {
  ApproverLevel,
  TableNames,
  normalizeApproverEmail,
} from "@/components/src/policy";
import {
  type ApproverService,
  LEGACY_SERVICE_APPROVER_FLAGS,
  getServiceApproverResourceIds,
  unionResourceApprovers,
} from "@/components/src/utils/approversResources";
import {
  serverFetchAllDataFromCollection,
  serverGetApproversResources,
} from "@/lib/firebase/server/adminDb";
import { serverGetTenantResources } from "@/lib/tenant/serverGetTenantResources";

const emailsOf = (records: Array<Record<string, unknown>>): string[] => [
  ...new Set(
    records
      .map((record) => record.email)
      .filter((email): email is string => typeof email === "string")
      .map(normalizeApproverEmail)
      .filter(Boolean),
  ),
];

const usersWithFlag = async (
  flag: string,
  tenant?: string,
): Promise<string[]> =>
  emailsOf(
    await serverFetchAllDataFromCollection<Record<string, unknown>>(
      TableNames.USERS_RIGHTS,
      [{ field: flag, operator: "==", value: true }],
      tenant,
    ),
  );

/** Tenant-wide approvers for `service` from the `usersRights` flags. */
export const serverListLegacyServiceApproverEmails = async (
  service: ApproverService,
  tenant?: string,
): Promise<string[]> => {
  const { flag, fallbackFlag } = LEGACY_SERVICE_APPROVER_FLAGS[service];
  const emails = await usersWithFlag(flag, tenant);
  if (emails.length > 0 || !fallbackFlag) return emails;
  return usersWithFlag(fallbackFlag, tenant);
};

const serverListEquipmentUserEmails = async (
  tenant?: string,
): Promise<string[]> =>
  emailsOf(
    await serverFetchAllDataFromCollection<Record<string, unknown>>(
      TableNames.APPROVERS,
      [{ field: "level", operator: "==", value: ApproverLevel.EQUIPMENT }],
      tenant,
    ),
  );

/**
 * Who handles `service` on a booking: the service approvers of each booked
 * room that offers it. A room with none of its own keeps today's tenant-wide
 * approvers, so rooms nobody has configured behave as before:
 * - "notify": the `usersRights` flag holders, who get the request email.
 * - "act": those plus the Equipment Users, who reach the Services page and
 *   decide every service there.
 */
export const serverResolveServiceApproverEmails = async (
  roomId: unknown,
  service: ApproverService,
  tenant: string | undefined,
  audience: "notify" | "act",
): Promise<string[]> => {
  const resources = await serverGetTenantResources(tenant);
  const resourceIds = getServiceApproverResourceIds(roomId, service, resources);
  if (resourceIds.length === 0) return [];

  const docs = await serverGetApproversResources(resourceIds, tenant);
  const { approvers, uncovered } = unionResourceApprovers(
    resourceIds,
    (resourceId) => docs.get(resourceId)?.serviceApprovers[service] ?? [],
  );
  if (uncovered.length === 0) return approvers;

  const fallback = await serverListLegacyServiceApproverEmails(service, tenant);
  if (audience === "act") {
    fallback.push(...(await serverListEquipmentUserEmails(tenant)));
  }
  return [...new Set([...approvers, ...fallback])];
};
