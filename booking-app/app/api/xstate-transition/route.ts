import { DEFAULT_TENANT, TENANTS } from "@/components/src/constants/tenants";
import { NextRequest, NextResponse } from "next/server";

import {
  executeXStateTransition,
  getAvailableXStateTransitions,
} from "@/lib/stateMachines/xstateUtilsV5";

/**
 * Execute XState transition for ITP bookings
 * POST /api/xstate-transition
 * Body: { calendarEventId: string, eventType: string, email?: string, netId?: string, reason?: string }
 *
 * netId is the authoritative user id from the caller's session — needed because
 * some queued side effects (pre-ban logging inside /api/cancel-processing) key
 * off it. Reconstructing from email.split("@")[0] is wrong for aliases.
 */
export async function POST(req: NextRequest) {
  const { calendarEventId, eventType, email, netId, reason } = await req.json();

  // Get tenant from x-tenant header, fallback to default tenant
  const tenant = req.headers.get("x-tenant") || DEFAULT_TENANT;

  // Only allow XState transitions for ITP and Media Commons tenants
  if (tenant !== TENANTS.ITP && tenant !== TENANTS.MC) {
    return NextResponse.json(
      {
        error:
          "XState transitions are only supported for ITP and Media Commons tenants",
      },
      { status: 400 },
    );
  }

  if (!calendarEventId || !eventType) {
    return NextResponse.json(
      { error: "Missing required fields: calendarEventId, eventType" },
      { status: 400 },
    );
  }

  const validEventTypes = [
    "approve",
    "decline",
    "cancel",
    "edit",
    "checkIn",
    "checkOut",
    "noShow",
    "close",
    "autoCloseScript",
    // Media Commons specific events
    "approveSetup",
    "approveStaff",
    "declineSetup",
    "declineStaff",
    "closeoutSetup",
    "closeoutStaff",
    "approveCatering",
    "approveCleaning",
    "approveSecurity",
    "declineCatering",
    "declineCleaning",
    "declineSecurity",
    "approveEquipment",
    "closeoutCatering",
    "closeoutCleaning",
    "closeoutSecurity",
    "declineEquipment",
    "closeoutEquipment",
  ];

  if (!validEventTypes.includes(eventType)) {
    return NextResponse.json(
      {
        error: `Invalid event type. Must be one of: ${validEventTypes.join(", ")}`,
      },
      { status: 400 },
    );
  }

  try {
    console.log(`🎬 XSTATE TRANSITION REQUEST [${tenant?.toUpperCase()}]:`, {
      calendarEventId,
      eventType,
      email,
      tenant,
      reason,
    });

    const result = await executeXStateTransition(
      calendarEventId,
      eventType,
      tenant,
      email, // Pass email for finalApprovedBy
      reason, // Pass reason for decline actions
      netId, // Pass authoritative netId for side effects (pre-ban logging)
    );

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    console.log(`✅ XSTATE TRANSITION SUCCESS [${tenant?.toUpperCase()}]:`, {
      calendarEventId,
      eventType,
      newState: result.newState,
    });

    return NextResponse.json({
      success: true,
      newState: result.newState,
      message: `Successfully transitioned to ${result.newState}`,
    });
  } catch (error) {
    console.error(`🚨 XSTATE TRANSITION ERROR [${tenant?.toUpperCase()}]:`, {
      calendarEventId,
      eventType,
      error: error.message,
    });

    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * Get available XState transitions for a booking
 * GET /api/xstate-transition?calendarEventId=xxx
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const calendarEventId = searchParams.get("calendarEventId");

  // Get tenant from x-tenant header, fallback to default tenant
  const tenant = req.headers.get("x-tenant") || DEFAULT_TENANT;

  // Only allow XState transitions for ITP and Media Commons tenants
  if (tenant !== TENANTS.ITP && tenant !== TENANTS.MC) {
    return NextResponse.json(
      {
        error:
          "XState transitions are only supported for ITP and Media Commons tenants",
      },
      { status: 400 },
    );
  }

  if (!calendarEventId) {
    return NextResponse.json(
      { error: "Missing required parameter: calendarEventId" },
      { status: 400 },
    );
  }

  try {
    console.log(
      `🔍 GETTING AVAILABLE XSTATE TRANSITIONS [${tenant?.toUpperCase()}]:`,
      {
        calendarEventId,
        tenant,
      },
    );
    const availableTransitions = await getAvailableXStateTransitions(
      calendarEventId,
      tenant,
    );

    console.log(`📋 AVAILABLE XSTATE TRANSITIONS [${tenant?.toUpperCase()}]:`, {
      calendarEventId,
      availableTransitions,
    });

    return NextResponse.json({
      calendarEventId,
      availableTransitions,
    });
  } catch (error) {
    console.error(
      `🚨 ERROR GETTING XSTATE TRANSITIONS [${tenant?.toUpperCase()}]:`,
      {
        calendarEventId,
        error: error.message,
      },
    );

    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
