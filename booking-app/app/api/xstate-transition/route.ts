import { DEFAULT_TENANT } from "@/components/src/constants/tenants";
import { NextRequest, NextResponse } from "next/server";

import {
  executeXStateTransition,
  getAvailableXStateTransitions,
} from "@/lib/stateMachines/xstateUtils";

/**
 * Execute XState transition for ITP bookings
 * POST /api/xstate-transition
 * Body: { calendarEventId: string, eventType: string, email?: string }
 */
export async function POST(req: NextRequest) {
  const { calendarEventId, eventType, email } = await req.json();

  // Get tenant from x-tenant header, fallback to default tenant
  const tenant = req.headers.get("x-tenant") || DEFAULT_TENANT;

  // Only allow XState transitions for ITP and Media Commons tenants
  if (tenant !== "itp" && tenant !== "mediaCommons") {
    return NextResponse.json(
      { error: "XState transitions are only supported for ITP and Media Commons tenants" },
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
    });

    const result = await executeXStateTransition(
      calendarEventId,
      eventType,
      tenant,
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
  if (tenant !== "itp" && tenant !== "mediaCommons") {
    return NextResponse.json(
      { error: "XState transitions are only supported for ITP and Media Commons tenants" },
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
    console.log(`🔍 GETTING AVAILABLE XSTATE TRANSITIONS [${tenant?.toUpperCase()}]:`, {
      calendarEventId,
      tenant,
    });

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
    console.error(`🚨 ERROR GETTING XSTATE TRANSITIONS [${tenant?.toUpperCase()}]:`, {
      calendarEventId,
      error: error.message,
    });

    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
