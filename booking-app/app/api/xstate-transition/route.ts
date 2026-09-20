import { DEFAULT_TENANT, TENANTS } from "@/components/src/constants/tenants";
import { requireSession } from "@/lib/api/requireSession";
import { shouldBypassAuth } from "@/lib/utils/testEnvironment";
import { NextRequest, NextResponse } from "next/server";

import {
  executeXStateTransition,
  getAvailableXStateTransitions,
} from "@/lib/stateMachines/xstateUtilsV5";
import {
  MEDIA_COMMONS_SERVICE_KEYS,
  type MediaCommonsServiceKey,
} from "@/components/src/utils/serviceDecisions";

/** Keep only known service keys from an "edit" event's changed-services list. */
const toChangedServices = (value: unknown): MediaCommonsServiceKey[] | undefined =>
  Array.isArray(value)
    ? (value.filter((key): key is MediaCommonsServiceKey =>
        (MEDIA_COMMONS_SERVICE_KEYS as readonly string[]).includes(key),
      ) as MediaCommonsServiceKey[])
    : undefined;

/**
 * Execute XState transition for ITP bookings
 * POST /api/xstate-transition
 * Body: { calendarEventId: string, eventType: string, email?: string, netId?: string, reason?: string, changedServices?: string[] }
 *
 * changedServices accompanies an "edit" event: the services whose requests
 * changed, so the machine resets only their decisions (ADR-0001).
 *
 * netId is the authoritative user id from the caller's session — needed because
 * some queued side effects (pre-ban logging inside /api/cancel-processing) key
 * off it. Reconstructing from email.split("@")[0] is wrong for aliases.
 */
export async function POST(req: NextRequest) {
  const { calendarEventId, eventType, email, netId, reason, changedServices } =
    await req.json();

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
    "approveFurnishings",
    "declineFurnishings",
    "closeoutFurnishings",
  ];

  if (!validEventTypes.includes(eventType)) {
    return NextResponse.json(
      {
        error: `Invalid event type. Must be one of: ${validEventTypes.join(", ")}`,
      },
      { status: 400 },
    );
  }

  let actorEmail = email;
  let actorNetId = netId;
  if (eventType === "noShow") {
    const session = await requireSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // The request body describes client state and must not determine who is
    // recorded in the audit trail. In E2E mode there is no real user session,
    // so retain the explicitly mocked actor identity used by the flow tests.
    if (!shouldBypassAuth()) {
      actorEmail = session.email;
      actorNetId = session.netId;
    } else {
      actorEmail = email || session.email;
      actorNetId = netId || session.netId;
    }
  }

  try {
    console.log(`🎬 XSTATE TRANSITION REQUEST [${tenant?.toUpperCase()}]:`, {
      calendarEventId,
      eventType,
      email: actorEmail,
      tenant,
      reason,
    });

    const result = await executeXStateTransition(
      calendarEventId,
      eventType,
      tenant,
      actorEmail, // Authenticated operator for no-show history attribution
      reason, // Pass reason for decline actions
      actorNetId, // Authenticated operator netId for no-show attribution
      toChangedServices(changedServices),
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
