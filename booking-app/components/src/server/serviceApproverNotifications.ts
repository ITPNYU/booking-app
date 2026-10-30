import { DEFAULT_TENANT } from "@/components/src/constants/tenants";
import { TableNames } from "@/components/src/policy";
import { serverBookingContents } from "@/components/src/server/admin";
import { getTenantEmailConfig } from "@/components/src/server/emails";
import { BookingStatusLabel } from "@/components/src/types";
import { getServiceDecisions } from "@/components/src/utils/serviceDecisions";
import type { ApproverService } from "@/components/src/utils/approversResources";
import { getMediaCommonsServices } from "@/components/src/utils/tenantUtils";
import { serverGetDataByCalendarEventId } from "@/lib/firebase/server/adminDb";
import { serverResolveServiceApproverEmails } from "@/lib/firebase/server/serviceApprovers";
import { serverGetTenantResources } from "@/lib/tenant/serverGetTenantResources";

const SERVICE_APPROVER_CONFIG: Record<
  ApproverService,
  { subjectStatus: string; displayName: string }
> = {
  setup: { subjectStatus: "SETUP REQUESTED", displayName: "setup" },
  equipment: { subjectStatus: "EQUIPMENT REQUESTED", displayName: "equipment" },
  staff: { subjectStatus: "STAFFING REQUESTED", displayName: "staffing" },
  catering: { subjectStatus: "CATERING REQUESTED", displayName: "catering" },
  cleaning: { subjectStatus: "CLEANUP REQUESTED", displayName: "cleanup" },
  security: { subjectStatus: "SECURITY REQUESTED", displayName: "security" },
  furnishings: {
    subjectStatus: "FURNISHINGS REQUESTED",
    displayName: "furnishings",
  },
};

export const isServicesRequestState = (newState: any): boolean =>
  !!(
    newState &&
    typeof newState === "object" &&
    newState !== null &&
    "Services Request" in (newState as Record<string, any>)
  );

export const notifyServiceApproversForRequestedServices = async (
  calendarEventId: string,
  tenant: string,
) => {
  const booking = await serverGetDataByCalendarEventId<any>(
    TableNames.BOOKING,
    calendarEventId,
    tenant,
  );

  if (!booking) {
    return;
  }

  const servicesRequested = getMediaCommonsServices(
    booking,
    await serverGetTenantResources(tenant),
  );
  // A resubmitted edit keeps the decisions of unchanged services (ADR-0001);
  // those land straight in their final state and need no approver.
  const decisions = getServiceDecisions(booking);
  const bookingContents = await serverBookingContents(calendarEventId, tenant);
  const emailConfig = await getTenantEmailConfig(tenant);
  const schemaName = emailConfig.schemaName;

  const pendingServices = (
    Object.keys(SERVICE_APPROVER_CONFIG) as ApproverService[]
  ).filter(
    (service) =>
      servicesRequested[service] && typeof decisions[service] !== "boolean",
  );
  const recipientsByService = await Promise.all(
    pendingServices.map(
      async (service) =>
        [
          service,
          await serverResolveServiceApproverEmails(
            booking.roomId,
            service,
            tenant,
            "notify",
          ),
        ] as const,
    ),
  );

  const emailJobs = recipientsByService.flatMap(([service, recipients]) => {
    const config = SERVICE_APPROVER_CONFIG[service];
    return recipients.map((recipient) =>
      fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/sendEmail`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-tenant": tenant || DEFAULT_TENANT,
        },
        body: JSON.stringify({
          templateName: "booking_detail",
          contents: {
            ...bookingContents,
            headerMessage: `A ${config.displayName} service approval is required for this request.`,
          },
          targetEmail: recipient,
          status: BookingStatusLabel.PRE_APPROVED,
          subjectStatusOverride: config.subjectStatus,
          eventTitle: bookingContents.title || "",
          requestNumber: bookingContents.requestNumber,
          bodyMessage: "",
          replyTo: bookingContents.email,
          schemaName,
        }),
      }),
    );
  });

  await Promise.all(emailJobs);
};
