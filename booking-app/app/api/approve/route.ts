import { DEFAULT_TENANT } from "@/components/src/constants/tenants";
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
        const { serverGetDataByCalendarEventId } = await import(
          "@/lib/firebase/server/adminDb"
        );
        const { TableNames } = await import("@/components/src/policy");
        const { BookingStatusLabel } = await import("@/components/src/types");

        const doc = await serverGetDataByCalendarEventId<{
          id: string;
          requestNumber: number;
        }>(TableNames.BOOKING, id, tenant);

        // Use finalApprove function for complete and consistent processing
        try {
          const { finalApprove } = await import(
            "@/components/src/server/admin"
          );

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
          const { serverFirstApproveOnly } = await import(
            "@/components/src/server/admin"
          );

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
        const { serverGetDataByCalendarEventId } = await import(
          "@/lib/firebase/server/adminDb"
        );
        const { TableNames } = await import("@/components/src/policy");
        const { BookingStatusLabel } = await import("@/components/src/types");

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
