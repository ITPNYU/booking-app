import { DEFAULT_TENANT } from "@/components/src/constants/tenants";
import { TableNames } from "@/components/src/policy";
import { serverBookingContents } from "@/components/src/server/admin";
import { getTenantEmailConfig } from "@/components/src/server/emails";
import { BookingStatusLabel } from "@/components/src/types";
import { getMediaCommonsServices } from "@/components/src/utils/tenantUtils";
import type { SchemaContextType } from "@/components/src/client/routes/components/SchemaProvider";
import {
  serverFetchAllDataFromCollection,
  serverGetDataByCalendarEventId,
  serverGetDocumentById,
} from "@/lib/firebase/server/adminDb";

const SERVICE_APPROVER_CONFIG = {
  setup: {
    flagField: "isSetup",
    subjectStatus: "SETUP REQUESTED",
    displayName: "setup",
    schemaServiceType: "setup",
  },
  equipment: {
    flagField: "isEquipment",
    subjectStatus: "EQUIPMENT REQUESTED",
    displayName: "equipment",
    schemaServiceType: "equipment",
  },
  // booking state machine uses the key "staff" internally, but the tenant schema
  // stores this service type as "staffing" — use schemaServiceType for schema lookups
  staff: {
    flagField: "isStaffing",
    subjectStatus: "STAFFING REQUESTED",
    displayName: "staffing",
    schemaServiceType: "staffing",
  },
  catering: {
    flagField: "isCatering",
    subjectStatus: "CATERING REQUESTED",
    displayName: "catering",
    schemaServiceType: "catering",
  },
  cleaning: {
    flagField: "isCleaning",
    subjectStatus: "CLEANUP REQUESTED",
    displayName: "cleanup",
    schemaServiceType: "cleaning",
  },
  security: {
    flagField: "isSecurity",
    subjectStatus: "SECURITY REQUESTED",
    displayName: "security",
    schemaServiceType: "security",
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

  // Fetch tenantSchema and usersRights in parallel
  const [schema, usersRights] = await Promise.all([
    serverGetDocumentById<SchemaContextType>(TableNames.TENANT_SCHEMA, tenant),
    serverFetchAllDataFromCollection<any>(TableNames.USERS_RIGHTS, [], tenant),
  ]);

  const bookingContents = await serverBookingContents(calendarEventId, tenant);
  const emailConfig = await getTenantEmailConfig(tenant);
  const schemaName = emailConfig.schemaName;

  // Find the resource matching this booking's roomId (booking.roomId is a string)
  const matchingResource = schema?.resources?.find(
    (r) => r.roomId.toString() === booking.roomId?.toString(),
  );

  const emailJobs = Object.entries(SERVICE_APPROVER_CONFIG).flatMap(
    ([serviceKey, config]) => {
      if (!servicesRequested[serviceKey as keyof typeof servicesRequested]) {
        return [];
      }

      // Resolve recipients from per-service approvers configured in the tenant schema
      let recipients: string[] = [];

      if (matchingResource) {
        // Normalize to handle Firestore data that hasn't been migrated from string[] yet.
        // Use schemaServiceType (e.g. "staffing") rather than serviceKey (e.g. "staff")
        // because the schema stores the type under the display name, not the internal key.
        const serviceEntry = matchingResource.services
          ?.map((s: any) =>
            typeof s === "string"
              ? { type: s, approvers: [] }
              : s != null && typeof s === "object"
                ? { type: s.type ?? "", approvers: Array.isArray(s.approvers) ? s.approvers : [] }
                : { type: "", approvers: [] },
          )
          .find((s) => s.type === config.schemaServiceType);

        if (serviceEntry && serviceEntry.approvers.length > 0) {
          recipients = Array.from(new Set(serviceEntry.approvers.filter(Boolean)));
        }
      }

      // Fallback to legacy usersRights flags when no per-service approvers are configured in the schema
      if (recipients.length === 0) {
        recipients = Array.from(
          new Set(
            usersRights
              .filter((record) => record[config.flagField] === true)
              .map((record) => record.email)
              .filter(Boolean),
          ),
        );
      }

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
