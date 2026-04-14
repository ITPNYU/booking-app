import { DEFAULT_TENANT } from "@/components/src/constants/tenants";
import { BookingStatusLabel } from "@/components/src/types";
import * as admin from "firebase-admin";
import type { PersistedXStateData, PreApprovalUpdateData } from "../xstateTypes";
import type { HandlerContext, StateHandler } from "./types";

/**
 * Handler for the `Pre-approved` state entry.
 *
 * Heavy branch: stamps `firstApprovedAt` / `firstApprovedBy`, pre-saves
 * the pre-approval fields and persisted XState snapshot to Firestore
 * via a dedicated write, then updates the Google Calendar event title
 * with the `[PRE-APPROVED]` prefix.
 */
export const handlePreApprovedEntry: StateHandler = async (
  ctx: HandlerContext,
) => {
  const {
    calendarEventId,
    email,
    tenant,
    previousState,
    newState,
    firestoreUpdates,
  } = ctx;

  firestoreUpdates.firstApprovedAt = admin.firestore.Timestamp.now();
  if (email) {
    firestoreUpdates.firstApprovedBy = email;
  }

  console.log(
    `⏳ XSTATE REACHED PRE-APPROVED [${tenant?.toUpperCase() || "UNKNOWN"}]:`,
    {
      calendarEventId,
      previousState,
      newState,
      firstApprovedAt: firestoreUpdates.firstApprovedAt,
      firstApprovedBy: firestoreUpdates.firstApprovedBy,
    },
  );

  try {
    const { serverUpdateDataByCalendarEventId } =
      await import("@/components/src/server/admin");
    const { TableNames } = await import("@/components/src/policy");
    const preApprovalUpdateData: PreApprovalUpdateData = {
      firstApprovedAt:
        firestoreUpdates.firstApprovedAt as admin.firestore.Timestamp,
      ...(firestoreUpdates.firstApprovedBy
        ? { firstApprovedBy: firestoreUpdates.firstApprovedBy as string }
        : {}),
    };

    if (firestoreUpdates.xstateData) {
      preApprovalUpdateData.xstateData =
        firestoreUpdates.xstateData as PersistedXStateData;
    }

    await serverUpdateDataByCalendarEventId(
      TableNames.BOOKING,
      calendarEventId,
      preApprovalUpdateData,
      tenant,
    );

    console.log(
      `💾 PRE-APPROVED DATA SAVED TO DB BEFORE CALENDAR UPDATE [${tenant?.toUpperCase() || "UNKNOWN"}]:`,
      {
        calendarEventId,
        savedFields: Object.keys(preApprovalUpdateData),
        hasXStateData: !!preApprovalUpdateData.xstateData,
      },
    );
  } catch (error) {
    console.error(
      `🚨 FAILED TO PRE-SAVE PRE-APPROVED DATA [${tenant?.toUpperCase() || "UNKNOWN"}]:`,
      {
        calendarEventId,
        error: error instanceof Error ? error.message : String(error),
      },
    );
    // Don't throw - continue with calendar update even if DB save failed
  }

  // Update calendar event with PRE_APPROVED status
  try {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_BASE_URL}/api/calendarEvents`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "x-tenant": tenant || DEFAULT_TENANT,
        },
        body: JSON.stringify({
          calendarEventId,
          newValues: { statusPrefix: BookingStatusLabel.PRE_APPROVED },
        }),
      },
    );

    if (response.ok) {
      console.log(
        `📅 XSTATE PRE-APPROVED CALENDAR UPDATED [${tenant?.toUpperCase() || "UNKNOWN"}]:`,
        {
          calendarEventId,
          statusPrefix: BookingStatusLabel.PRE_APPROVED,
        },
      );
    } else {
      console.error(
        `🚨 XSTATE PRE-APPROVED CALENDAR UPDATE FAILED [${tenant?.toUpperCase() || "UNKNOWN"}]:`,
        {
          calendarEventId,
          status: response.status,
          statusText: response.statusText,
        },
      );
    }
  } catch (error) {
    console.error(
      `🚨 XSTATE PRE-APPROVED CALENDAR UPDATE ERROR [${tenant?.toUpperCase() || "UNKNOWN"}]:`,
      {
        calendarEventId,
        error: error instanceof Error ? error.message : String(error),
      },
    );
  }
};
