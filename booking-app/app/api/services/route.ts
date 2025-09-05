import { DEFAULT_TENANT } from "@/components/src/constants/tenants";
import { NextRequest, NextResponse } from "next/server";

import { shouldUseXState } from "@/components/src/utils/tenantUtils";
import { executeXStateTransition } from "@/lib/stateMachines/xstateUtilsV5";

export async function POST(req: NextRequest) {
  const { calendarEventId, serviceType, action, email } = await req.json();

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
  if (!["approve", "decline"].includes(action)) {
    return NextResponse.json(
      { error: "Invalid action. Must be 'approve' or 'decline'" },
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

      const xstateResult = await executeXStateTransition(
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
          // Create service-specific status label
          const serviceDisplayName =
            serviceType.charAt(0).toUpperCase() + serviceType.slice(1);
          const actionDisplayName =
            action === "approve" ? "Approved" : "Declined";
          const serviceStatus = `${serviceDisplayName} Service ${actionDisplayName}`;

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
                status: serviceStatus, // e.g., "Staff Service Approved", "Equipment Service Declined"
                changedBy: email,
                requestNumber: doc.requestNumber,
                note: null,
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
                status: serviceStatus,
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
