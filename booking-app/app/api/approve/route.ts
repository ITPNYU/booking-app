import { DEFAULT_TENANT } from "@/components/src/constants/tenants";
import { NextRequest, NextResponse } from "next/server";

import { serverApproveBooking } from "@/components/src/server/admin";
import { executeXStateTransition } from "@/lib/stateMachines/xstateUtils";

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
        usingXState: tenant === "itp",
      },
    );

    // For ITP tenant, use XState transition
    if (tenant === "itp") {
      console.log(`🎭 USING XSTATE FOR APPROVAL [ITP]:`, {
        calendarEventId: id,
      });

      const xstateResult = await executeXStateTransition(id, "approve", tenant);

      if (!xstateResult.success) {
        console.error(`🚨 XSTATE APPROVAL FAILED [ITP]:`, {
          calendarEventId: id,
          error: xstateResult.error,
        });

        // Fallback to traditional approval if XState fails
        console.log(`🔄 FALLING BACK TO TRADITIONAL APPROVAL [ITP]:`, {
          calendarEventId: id,
        });
        await serverApproveBooking(id, email, tenant);
      } else {
        console.log(`✅ XSTATE APPROVAL SUCCESS [ITP]:`, {
          calendarEventId: id,
          newState: xstateResult.newState,
        });

        // Still call traditional approval for side effects (emails, status updates)
        await serverApproveBooking(id, email, tenant);
      }
    } else {
      // Traditional approval for non-ITP tenants
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
