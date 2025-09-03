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
            `🎉 XSTATE REACHED APPROVED STATE - EXECUTING FINAL APPROVAL SIDE EFFECTS [${tenant?.toUpperCase()}]:`,
            {
              calendarEventId: id,
              newState: xstateResult.newState,
            },
          );

          // Execute traditional approval for side effects (emails, calendar updates, etc.)
          await serverApproveBooking(id, email, tenant);
        } else if (xstateResult.newState === "Pre-approved") {
          console.log(
            `🎯 XSTATE REACHED PRE-APPROVED STATE - EXECUTING FIRST APPROVAL SIDE EFFECTS [${tenant?.toUpperCase()}]:`,
            {
              calendarEventId: id,
              newState: xstateResult.newState,
            },
          );

          // Execute first approval side effects (update firstApprovedAt, etc.)
          const { serverFirstApproveOnly } = await import(
            "@/components/src/server/admin"
          );
          await serverFirstApproveOnly(id, email, tenant);
        } else {
          console.log(
            `🚫 XSTATE DID NOT REACH EXPECTED STATE - SKIPPING APPROVAL SIDE EFFECTS [${tenant?.toUpperCase()}]:`,
            {
              calendarEventId: id,
              newState: xstateResult.newState,
              expectedStates: ["Approved", "Pre-approved"],
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
