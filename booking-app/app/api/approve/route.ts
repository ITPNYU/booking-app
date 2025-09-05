import { DEFAULT_TENANT } from "@/components/src/constants/tenants";
import { NextRequest, NextResponse } from "next/server";

import { serverApproveBooking } from "@/components/src/server/admin";
import { shouldUseXState } from "@/components/src/utils/tenantUtils";
import { executeXStateTransition } from "@/lib/stateMachines/xstateUtilsV5";

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
        usingXState: shouldUseXState(tenant),
      },
    );

    // For ITP and Media Commons tenants, use XState transition
    if (shouldUseXState(tenant)) {
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
                  status: BookingStatusLabel.APPROVED,
                  changedBy: email,
                  requestNumber: doc.requestNumber,
                  note: null,
                }),
              },
            );

            if (logResponse.ok) {
              console.log(
                `📋 XSTATE FINAL APPROVAL HISTORY LOGGED [${tenant?.toUpperCase()}]:`,
                {
                  calendarEventId: id,
                  bookingId: doc.id,
                  requestNumber: doc.requestNumber,
                  status: BookingStatusLabel.APPROVED,
                },
              );
            } else {
              console.error(
                `🚨 XSTATE FINAL APPROVAL HISTORY LOG FAILED [${tenant?.toUpperCase()}]:`,
                {
                  calendarEventId: id,
                  status: logResponse.status,
                },
              );
            }
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
        } else if (
          typeof xstateResult.newState === "object" &&
          xstateResult.newState !== null &&
          "Services Request" in xstateResult.newState
        ) {
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
    } else {
      // Traditional approval for other tenants

      console.log(
        `📝 USING TRADITIONAL APPROVAL [${tenant?.toUpperCase() || "UNKNOWN"}]:`,
        { calendarEventId: id },
      );
      await serverApproveBooking(id, email, tenant);
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
