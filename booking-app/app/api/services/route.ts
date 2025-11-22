import { DEFAULT_TENANT } from "@/components/src/constants/tenants";
import { NextRequest, NextResponse } from "next/server";

import { shouldUseXState } from "@/components/src/utils/tenantUtils";
import { executeXStateTransition } from "@/lib/stateMachines/xstateUtilsV5";

export async function POST(req: NextRequest) {
  const { calendarEventId, serviceType, action, email, reason } = await req.json();

  // Get tenant from x-tenant header, fallback to default tenant
  const tenant = req.headers.get("x-tenant") || DEFAULT_TENANT;

  // Validate input
  if (!calendarEventId || !serviceType || !action || !email) {
    return NextResponse.json(
      {
        error:
          "Missing required fields: calendarEventId, serviceType, action, email",
      },
      { status: 400 },
    );
  }

  // Validate serviceType
  const validServices = [
    "staff",
    "equipment",
    "catering",
    "cleaning",
    "security",
    "setup",
  ];
  if (!validServices.includes(serviceType)) {
    return NextResponse.json(
      {
        error: `Invalid serviceType. Must be one of: ${validServices.join(", ")}`,
      },
      { status: 400 },
    );
  }

  // Validate action
  if (!["approve", "decline", "closeout"].includes(action)) {
    return NextResponse.json(
      { error: "Invalid action. Must be 'approve', 'decline', or 'closeout'" },
      { status: 400 },
    );
  }

  try {
    console.log(
      `🎯 SERVICE ${action.toUpperCase()} REQUEST [${tenant?.toUpperCase() || "UNKNOWN"}]:`,
      {
        calendarEventId,
        serviceType,
        action,
        email,
        tenant,
        usingXState: shouldUseXState(tenant),
      },
    );

    // Declare xstateResult in outer scope for access in response
    let xstateResult: any = null;

    // For ITP and Media Commons tenants, use XState transition
    if (shouldUseXState(tenant)) {
      console.log(
        `🎭 USING XSTATE FOR SERVICE ${action.toUpperCase()} [${tenant?.toUpperCase()}]:`,
        {
          calendarEventId,
          serviceType,
          action,
        },
      );

      // Create XState event type (e.g., "approveStaff", "declineEquipment")
      const capitalizedServiceType =
        serviceType.charAt(0).toUpperCase() + serviceType.slice(1);
      const eventType = `${action}${capitalizedServiceType}`;

      xstateResult = await executeXStateTransition(
        calendarEventId,
        eventType,
        tenant,
        email,
      );

      if (!xstateResult.success) {
        console.error(
          `🚨 XSTATE SERVICE ${action.toUpperCase()} FAILED [${tenant?.toUpperCase()}]:`,
          {
            calendarEventId,
            serviceType,
            action,
            error: xstateResult.error,
          },
        );

        return NextResponse.json(
          { error: `XState service ${action} failed: ${xstateResult.error}` },
          { status: 500 },
        );
      } else {
        console.log(
          `✅ XSTATE SERVICE ${action.toUpperCase()} SUCCESS [${tenant?.toUpperCase()}]:`,
          {
            calendarEventId,
            serviceType,
            action,
            newState: xstateResult.newState,
          },
        );

        // Check if the overall booking transitioned to final states
        const transitionedToDeclined = xstateResult.newState === "Declined";
        const transitionedToApproved = xstateResult.newState === "Approved";
        const transitionedToClosed = xstateResult.newState === "Closed";

        // Add history logging for individual service approve/decline since XState doesn't handle history
        const { serverGetDataByCalendarEventId } = await import(
          "@/lib/firebase/server/adminDb"
        );
        const { TableNames } = await import("@/components/src/policy");
        const { BookingStatusLabel } = await import("@/components/src/types");

        const doc = await serverGetDataByCalendarEventId<{
          id: string;
          requestNumber: number;
        }>(TableNames.BOOKING, calendarEventId, tenant);

        if (doc) {
          // Create service-specific note for history
          const serviceDisplayName =
            serviceType.charAt(0).toUpperCase() + serviceType.slice(1);
          const actionDisplayName =
            action === "approve"
              ? "Approved"
              : action === "decline"
                ? "Declined"
                : "Closed Out";
          const baseServiceNote = `${serviceDisplayName} Service ${actionDisplayName}`;
          const serviceNote =
            action === "decline" && reason && String(reason).trim().length > 0
              ? `${baseServiceNote}: ${reason}`
              : baseServiceNote;

          // Determine appropriate status for history log
          const historyStatus =
            action === "closeout"
              ? BookingStatusLabel.CHECKED_OUT
              : BookingStatusLabel.PRE_APPROVED;

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
                calendarEventId,
                status: historyStatus, // PRE-APPROVED for approve/decline, CHECKED_OUT for closeout
                changedBy: email,
                requestNumber: doc.requestNumber,
                note: serviceNote, // e.g., "Staff Service Declined: out of stock"
              }),
            },
          );

          if (logResponse.ok) {
            console.log(
              `📋 XSTATE SERVICE ${action.toUpperCase()} HISTORY LOGGED [${tenant?.toUpperCase()}]:`,
              {
                calendarEventId,
                bookingId: doc.id,
                requestNumber: doc.requestNumber,
                serviceType,
                action,
                note: serviceNote,
              },
            );
          } else {
            console.error(
              `🚨 XSTATE SERVICE ${action.toUpperCase()} HISTORY LOG FAILED [${tenant?.toUpperCase()}]:`,
              {
                calendarEventId,
                serviceType,
                action,
                status: logResponse.status,
              },
            );
          }

          // If the booking transitioned to Declined state, add a separate history log for the overall decline
          // For multi-service declines, attribute final decline to System, not the last service decliner
          if (transitionedToDeclined && doc) {
            const declineLogResponse = await fetch(
              `${process.env.NEXT_PUBLIC_BASE_URL}/api/booking-logs`,
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  "x-tenant": tenant || DEFAULT_TENANT,
                },
                body: JSON.stringify({
                  bookingId: doc.id,
                  calendarEventId,
                  status: BookingStatusLabel.DECLINED,
                  changedBy: "System",
                  requestNumber: doc.requestNumber,
                  note:
                    reason && String(reason).trim().length > 0
                      ? `Overall declined due to service: ${serviceDisplayName}. Reason: ${reason}`
                      : `Overall declined due to service: ${serviceDisplayName}`,
                }),
              },
            );

            if (declineLogResponse.ok) {
              console.log(
                `📋 OVERALL DECLINE HISTORY LOGGED [${tenant?.toUpperCase()}]:`,
                {
                  calendarEventId,
                  bookingId: doc.id,
                  requestNumber: doc.requestNumber,
                  status: BookingStatusLabel.DECLINED,
                  trigger: `${serviceType} service ${action}`,
                },
              );
            } else {
              console.error(
                `🚨 OVERALL DECLINE HISTORY LOG FAILED [${tenant?.toUpperCase()}]:`,
                {
                  calendarEventId,
                  status: declineLogResponse.status,
                },
              );
            }
          }

          // Handle APPROVED state: use finalApprove function for consistent processing
          if (transitionedToApproved && doc) {
            try {
              const { finalApprove } = await import(
                "@/components/src/server/admin"
              );

              // Use finalApprove function which handles:
              // 1. serverFinalApprove (booking update + service approvals)
              // 2. Logging final approval action
              // 3. serverApproveEvent (email + calendar update)
              await finalApprove(calendarEventId, "System", tenant);

              console.log(
                `📧 APPROVED PROCESSING COMPLETED [${tenant?.toUpperCase()}]:`,
                {
                  calendarEventId,
                  bookingId: doc.id,
                  requestNumber: doc.requestNumber,
                  trigger: `${serviceType} service ${action}`,
                  note: "Used finalApprove function for consistent approval processing",
                },
              );
            } catch (error) {
              console.error(
                `🚨 APPROVED PROCESSING FAILED [${tenant?.toUpperCase()}]:`,
                {
                  calendarEventId,
                  error: error.message,
                  trigger: `${serviceType} service ${action}`,
                },
              );
            }
          }

          // CLOSED state logging is now handled by XState action calling /api/close-processing
          // This avoids duplicate CLOSED logs in the history
          if (transitionedToClosed) {
            console.log(
              `🎯 TRANSITIONED TO CLOSED STATE [${tenant?.toUpperCase()}]:`,
              {
                calendarEventId,
                serviceType,
                action,
                note: "CLOSED logging handled by XState close processing action with proper ordering",
              },
            );
          }
        }
      }
    } else {
      // For non-XState tenants, return error since service-level approval is only for Media Commons
      return NextResponse.json(
        {
          error:
            "Service-level approval is only available for Media Commons tenants",
        },
        { status: 400 },
      );
    }

    return NextResponse.json(
      {
        message: `${serviceType} service ${action}d successfully`,
        serviceType,
        action,
        transitionedToApproved: shouldUseXState(tenant)
          ? xstateResult?.newState === "Approved"
          : false,
        transitionedToDeclined: shouldUseXState(tenant)
          ? xstateResult?.newState === "Declined"
          : false,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error(
      `🚨 SERVICE ${action.toUpperCase()} ERROR [${tenant?.toUpperCase() || "UNKNOWN"}]:`,
      {
        calendarEventId,
        serviceType,
        action,
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
