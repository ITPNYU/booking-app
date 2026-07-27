import { DEFAULT_TENANT } from "@/components/src/constants/tenants";
import { TableNames } from "@/components/src/policy";
import { serverBookingContents } from "@/components/src/server/admin";
import { getTenantEmailConfig } from "@/components/src/server/emails";
import { BookingStatusLabel } from "@/components/src/types";
import { getMediaCommonsServices } from "@/components/src/utils/tenantUtils";
import {
  serverFetchAllDataFromCollection,
  serverGetDataByCalendarEventId,
} from "@/lib/firebase/server/adminDb";

const SERVICE_APPROVER_CONFIG = {
  setup: {
    flagField: "isSetup",
    subjectStatus: "SETUP REQUESTED",
    displayName: "setup",
  },
  equipment: {
    flagField: "isEquipment",
    subjectStatus: "EQUIPMENT REQUESTED",
    displayName: "equipment",
  },
  staff: {
    flagField: "isStaffing",
    subjectStatus: "STAFFING REQUESTED",
    displayName: "staffing",
  },
  catering: {
    flagField: "isCatering",
    subjectStatus: "CATERING REQUESTED",
    displayName: "catering",
  },
  cleaning: {
    flagField: "isCleaning",
    subjectStatus: "CLEANUP REQUESTED",
    displayName: "cleanup",
  },
  security: {
    flagField: "isSecurity",
    subjectStatus: "SECURITY REQUESTED",
    displayName: "security",
  },
} as const;

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

  const servicesRequested = getMediaCommonsServices(booking);
  const usersRights = await serverFetchAllDataFromCollection<any>(
    TableNames.USERS_RIGHTS,
    [],
    tenant,
  );
  const bookingContents = await serverBookingContents(calendarEventId, tenant);
  const emailConfig = await getTenantEmailConfig(tenant);
  const schemaName = emailConfig.schemaName;

  const emailJobs = Object.entries(SERVICE_APPROVER_CONFIG).flatMap(
    ([serviceKey, config]) => {
      if (!servicesRequested[serviceKey as keyof typeof servicesRequested]) {
        return [];
      }

      const recipients = Array.from(
        new Set(
          usersRights
            .filter((record) => record[config.flagField] === true)
            .map((record) => record.email)
            .filter(Boolean),
        ),
      );

      if (recipients.length === 0) {
        return [];
      }

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
    },
  );

  await Promise.all(emailJobs);
};
