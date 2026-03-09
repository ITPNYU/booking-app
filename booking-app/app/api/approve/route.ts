import { DEFAULT_TENANT } from "@/components/src/constants/tenants";
import { TableNames } from "@/components/src/policy";
import { serverBookingContents } from "@/components/src/server/admin";
import { getTenantEmailConfig } from "@/components/src/server/emails";
import { BookingStatusLabel } from "@/components/src/types";
import { getMediaCommonsServices } from "@/components/src/utils/tenantUtils";
import { serverFetchAllDataFromCollection, serverGetDataByCalendarEventId } from "@/lib/firebase/server/adminDb";
import { NextRequest, NextResponse } from "next/server";

import { serverApproveBooking } from "@/components/src/server/admin";
import { executeXStateTransition } from "@/lib/stateMachines/xstateUtilsV5";

/**
 * Checks if the XState result indicates a transition to Services Request parallel state
 * This typically happens for Media Commons bookings with requested services
 */
function isServicesRequestState(newState: any): boolean {
  return (
    newState &&
    typeof newState === "object" &&
    newState !== null &&
    "Services Request" in (newState as Record<string, any>)
  );
}

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

const notifyServiceApproversForRequestedServices = async (
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

export async function POST(req: NextRequest) {
  const { id, email } = await req.json();

  // Get tenant from x-tenant header, fallback to default tenant
  const tenant = req.headers.get("x-tenant") || DEFAULT_TENANT;

  try {
    console.log(
      `🎯 APPROVAL REQUEST [${tenant?.toUpperCase() || "UNKNOWN"}]:`,
      {
        calendarEventId: id,
        email,
        tenant,
        usingXState: true,
      },
    );

    console.log(`🎭 USING XSTATE FOR APPROVAL [${tenant?.toUpperCase()}]:`, {
      calendarEventId: id,
    });

    const xstateResult = await executeXStateTransition(
      id,
      "approve",
      tenant,
      email,
    );

    if (!xstateResult.success) {
      console.error(`🚨 XSTATE APPROVAL FAILED [${tenant?.toUpperCase()}]:`, {
        calendarEventId: id,
        error: xstateResult.error,
      });

      // Fallback to traditional approval if XState fails
      console.log(
        `🔄 FALLING BACK TO TRADITIONAL APPROVAL [${tenant?.toUpperCase()}]:`,
        {
          calendarEventId: id,
        },
      );
      await serverApproveBooking(id, email, tenant);
    } else {
      console.log(`✅ XSTATE APPROVAL SUCCESS [${tenant?.toUpperCase()}]:`, {
        calendarEventId: id,
        newState: xstateResult.newState,
      });

      // Handle different XState results
      if (xstateResult.newState === "Approved") {
        console.log(
          `🎉 XSTATE REACHED APPROVED STATE - PROCESSING COMPLETE [${tenant?.toUpperCase()}]:`,
          {
            calendarEventId: id,
            newState: xstateResult.newState,
            note: "XState processing handled state transition and side effects",
          },
        );

        // Add history logging for final approval since XState doesn't handle history
        const doc = await serverGetDataByCalendarEventId<{
          id: string;
          requestNumber: number;
        }>(TableNames.BOOKING, id, tenant);

        // Use finalApprove function for complete and consistent processing
        try {
          const { finalApprove } =
            await import("@/components/src/server/admin");

          // finalApprove handles: serverFinalApprove + logging + serverApproveEvent
          await finalApprove(id, email, tenant);

          console.log(
            `✅ APPROVED PROCESSING COMPLETED [${tenant?.toUpperCase()}]:`,
            {
              calendarEventId: id,
              email,
              note: "Used finalApprove function for complete approval processing",
            },
          );
        } catch (error) {
          console.error(
            `🚨 APPROVED PROCESSING FAILED [${tenant?.toUpperCase()}]:`,
            {
              calendarEventId: id,
              email,
              tenant,
              error: error.message,
            },
          );
        }
      } else if (xstateResult.newState === "Pre-approved") {
        console.log(
          `🎯 XSTATE REACHED PRE-APPROVED STATE - PROCESSING COMPLETE [${tenant?.toUpperCase()}]:`,
          {
            calendarEventId: id,
            newState: xstateResult.newState,
            note: "XState processing handled state transition, now handling side effects",
          },
        );

        // Handle side effects (history logging and email) outside of XState
        try {
          const { serverFirstApproveOnly } =
            await import("@/components/src/server/admin");

          await serverFirstApproveOnly(id, email, tenant);

          console.log(
            `✅ PRE-APPROVED SIDE EFFECTS COMPLETED [${tenant?.toUpperCase()}]:`,
            {
              calendarEventId: id,
              email,
              note: "History logging and email sending completed via serverFirstApproveOnly",
            },
          );
        } catch (error) {
          console.error(
            `🚨 PRE-APPROVED SIDE EFFECTS FAILED [${tenant?.toUpperCase()}]:`,
            {
              calendarEventId: id,
              email,
              tenant,
              error: error.message,
            },
          );
        }
      } else if (isServicesRequestState(xstateResult.newState)) {
        // Handle Services Request parallel state for Media Commons
        console.log(
          `🔀 XSTATE REACHED SERVICES REQUEST STATE [${tenant?.toUpperCase()}]:`,
          {
            calendarEventId: id,
            newState: xstateResult.newState,
            note: "Media Commons booking transitioned to Services Request parallel state",
          },
        );

        // Add history logging for Services Request transition
        const doc = await serverGetDataByCalendarEventId<{
          id: string;
          requestNumber: number;
        }>(TableNames.BOOKING, id, tenant);

        if (doc) {
          const logResponse = await fetch(
            `${process.env.NEXT_PUBLIC_BASE_URL}/api/booking-logs`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "x-tenant": tenant || DEFAULT_TENANT,
              },
              body: JSON.stringify({
                bookingId: doc.id,
                calendarEventId: id,
                status: BookingStatusLabel.PRE_APPROVED, // Services Request is still PRE_APPROVED status
                changedBy: email,
                requestNumber: doc.requestNumber,
                note: null,
              }),
            },
          );

          if (logResponse.ok) {
            console.log(
              `📋 XSTATE SERVICES REQUEST HISTORY LOGGED [${tenant?.toUpperCase()}]:`,
              {
                calendarEventId: id,
                bookingId: doc.id,
                requestNumber: doc.requestNumber,
                status: BookingStatusLabel.PRE_APPROVED,
              },
            );
          } else {
            console.error(
              `🚨 XSTATE SERVICES REQUEST HISTORY LOG FAILED [${tenant?.toUpperCase()}]:`,
              {
                calendarEventId: id,
                status: logResponse.status,
              },
            );
          }

          try {
            await notifyServiceApproversForRequestedServices(id, tenant);
          } catch (notificationError) {
            console.error(
              `🚨 XSTATE SERVICES REQUEST NOTIFICATION FAILED [${tenant?.toUpperCase()}]:`,
              {
                calendarEventId: id,
                error:
                  notificationError instanceof Error
                    ? notificationError.message
                    : String(notificationError),
              },
            );
          }
        }
      } else {
        console.log(
          `🚫 XSTATE DID NOT REACH EXPECTED STATE - SKIPPING APPROVAL SIDE EFFECTS [${tenant?.toUpperCase()}]:`,
          {
            calendarEventId: id,
            newState: xstateResult.newState,
            expectedStates: ["Approved", "Pre-approved", "Services Request"],
          },
        );
      }
    }
    return NextResponse.json(
      { message: "Approved successfully" },
      { status: 200 },
    );
  } catch (error) {
    console.error(
      `🚨 APPROVAL ERROR [${tenant?.toUpperCase() || "UNKNOWN"}]:`,
      {
        calendarEventId: id,
        email,
        tenant,
        error: error.message,
      },
    );
    return NextResponse.json(
      { error: error.message },
      { status: error.status || 500 },
    );
  }
}
