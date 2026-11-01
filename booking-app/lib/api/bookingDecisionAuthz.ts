import { PagePermission } from "@/components/src/types";
import { parseBookingResourceIds } from "@/components/src/utils/approversResources";
import { resolveCallerRole } from "@/lib/api/authz";
import {
  serverGetFinalApproverEmail,
  serverResolveResourceApproverEmails,
} from "@/lib/firebase/server/adminDb";

export type BookingDecision = "approve" | "decline";

/**
 * Whether `email` may approve or decline `booking`.
 *
 * Admins always may. Liaisons give the first approval, and may decline at any
 * stage because the liaison page offers Decline for every status. Once the
 * booking has its first approval, the tenant final approver and the resource
 * approvers of any booked room may approve or decline it: a booking gets one
 * final approval, so an approver of one of its rooms can give it. The
 * resolver adds the tenant final approver for rooms with no approvers of
 * their own.
 */
export async function authorizeBookingDecision(
  email: string,
  tenant: string | undefined,
  booking: Record<string, unknown>,
  decision: BookingDecision,
): Promise<boolean> {
  const role = await resolveCallerRole(
    { email, netId: email.split("@")[0] },
    tenant,
  );
  if (role === PagePermission.ADMIN || role === PagePermission.SUPER_ADMIN) {
    return true;
  }

  if (
    role === PagePermission.LIAISON &&
    (decision === "decline" || !booking.firstApprovedAt)
  ) {
    return true;
  }

  if (!booking.firstApprovedAt) return false;

  const normalizedEmail = email.trim().toLowerCase();
  const tenantFinalApprover = await serverGetFinalApproverEmail(tenant);
  if (tenantFinalApprover?.trim().toLowerCase() === normalizedEmail) {
    return true;
  }

  const resourceIds = parseBookingResourceIds(booking.roomId);
  if (resourceIds.length === 0) return false;

  const approvers = await serverResolveResourceApproverEmails(
    resourceIds,
    tenant,
  );
  return approvers.includes(normalizedEmail);
}
