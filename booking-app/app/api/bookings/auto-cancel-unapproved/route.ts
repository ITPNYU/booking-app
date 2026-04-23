import type { SchemaContextType } from "@/components/src/client/routes/components/SchemaProvider";
import {
  extractTenantFromCollectionName,
  TableNames,
} from "@/components/src/policy";
import { callXStateTransitionAPI } from "@/components/src/server/db";
import { Booking, BookingStatusLabel } from "@/components/src/types";
import { getStatusFromXState } from "@/components/src/utils/statusFromXState";
import { serverGetDocumentById } from "@/lib/firebase/server/adminDb";
import admin from "@/lib/firebase/server/firebaseAdmin";
import { BookingLogger } from "@/lib/logger/bookingLogger";
import { Timestamp } from "firebase-admin/firestore";
import { NextRequest, NextResponse } from "next/server";

const db = admin.firestore();

// List of tenant collections to process
const TENANT_COLLECTIONS = ["itp-bookings", "mc-bookings"];

type AutoCancelObject = Exclude<
  NonNullable<SchemaContextType["autoCancel"]>,
  false
>;

function isAutoCancelEnabled(
  autoCancel: SchemaContextType["autoCancel"] | undefined,
): autoCancel is AutoCancelObject {
  return (
    typeof autoCancel === "object" &&
    autoCancel !== null &&
    autoCancel.minutesPriorToStart >= 0
  );
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const isDryRun = url.searchParams.get("dryRun") === "true";

  if (isDryRun) {
    BookingLogger.debug(
      "DRY RUN MODE ENABLED - No actual changes will be made",
      {},
    );
  }

  // --- Authorization Check ---
  const expectedToken = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");

  if (!expectedToken) {
    BookingLogger.apiError(
      "GET",
      "/api/bookings/auto-cancel-unapproved",
      {},
      new Error("CRON_SECRET environment variable is not set"),
    );
    return NextResponse.json(
      { message: "Internal Server Error: Configuration missing" },
      { status: 500 },
    );
  }

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return NextResponse.json(
      { message: "Unauthorized: Missing or invalid Authorization header" },
      { status: 401 },
    );
  }

  const token = authHeader.substring(7); // Remove "Bearer " prefix

  if (token !== expectedToken) {
    return NextResponse.json(
      { message: "Forbidden: Invalid token" },
      { status: 403 },
    );
  }
  // --- End Authorization Check ---

  // In E2E testing, Firestore is unavailable; return a mock dry-run response
  if (process.env.E2E_TESTING === "true" && isDryRun) {
    return NextResponse.json({
      message: "Dry run completed",
      totalUpdatedCount: 0,
      updatedBookingIds: [],
      dryRunResults: [],
      timestamp: new Date().toISOString(),
    });
  }

  try {
    const now = new Date();
    const nowTimestamp = Timestamp.fromDate(now);

    let totalUpdatedCount = 0;
    const allUpdatedBookingIds: { id: string; tenant: string }[] = [];
    const dryRunResults: {
      id: string;
      tenant: string;
      calendarEventId: string;
      xstateValue?: string;
      reason: string;
    }[] = [];

    for (const collectionName of TENANT_COLLECTIONS) {
      const tenant = extractTenantFromCollectionName(collectionName);

      BookingLogger.apiRequest("GET", "/api/bookings/auto-cancel-unapproved", {
        tenant,
        collection: collectionName,
      });

      const schema = await serverGetDocumentById<SchemaContextType>(
        TableNames.TENANT_SCHEMA,
        tenant,
      );

      if (!isAutoCancelEnabled(schema?.autoCancel)) {
        BookingLogger.debug("Auto-cancel disabled for tenant", {
          tenant,
          autoCancel: schema?.autoCancel ?? null,
        });
        continue;
      }

      const minutesPriorToStart = schema.autoCancel.minutesPriorToStart;
      const windowEnd = new Date(
        now.getTime() + minutesPriorToStart * 60 * 1000,
      );
      const windowEndTimestamp = Timestamp.fromDate(windowEnd);

      const allowedStatuses: BookingStatusLabel[] = [];
      if (schema.autoCancel.conditions?.requested) {
        allowedStatuses.push(BookingStatusLabel.REQUESTED);
      }
      if (schema.autoCancel.conditions?.preApproved) {
        allowedStatuses.push(BookingStatusLabel.PRE_APPROVED);
      }

      if (allowedStatuses.length === 0) {
        BookingLogger.debug("Auto-cancel enabled but no conditions set", {
          tenant,
          minutesPriorToStart,
          conditions: schema.autoCancel.conditions,
        });
        continue;
      }

      // Pull candidates starting within the configured window; status filtering happens in code
      const bookingsSnapshot = await db
        .collection(collectionName)
        .where("startDate", ">=", nowTimestamp)
        .where("startDate", "<=", windowEndTimestamp)
        .get();

      if (bookingsSnapshot.empty) continue;

      for (const doc of bookingsSnapshot.docs) {
        const booking = doc.data() as Booking;
        const bookingId = doc.id;

        if (!booking.calendarEventId) continue;
        if (booking.canceledAt) continue;
        if (booking.finalApprovedAt) continue;

        const currentStatus = getStatusFromXState(booking, tenant);
        if (!allowedStatuses.includes(currentStatus as BookingStatusLabel))
          continue;

        const reason = `Auto-canceled: not approved within the configured ${minutesPriorToStart}-minute window before start time`;

        if (isDryRun) {
          dryRunResults.push({
            id: bookingId,
            tenant,
            calendarEventId: booking.calendarEventId,
            xstateValue: booking.xstateData?.snapshot?.value,
            reason,
          });
          continue;
        }

        const xstateResult = await callXStateTransitionAPI(
          booking.calendarEventId,
          "cancel",
          "system",
          tenant,
          reason,
        );

        if (!xstateResult.success) {
          BookingLogger.xstateError(
            "Failed to auto-cancel unapproved booking",
            { bookingId, calendarEventId: booking.calendarEventId, tenant },
            new Error(xstateResult.error),
          );
          continue;
        }

        // cancel-processing is triggered by the machine's Canceled state
        // entry via queueCancelProcessing. No manual fetch here.

        if (xstateResult.newState === "Closed") {
          try {
            await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/close-processing`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "x-tenant": tenant,
              },
              body: JSON.stringify({
                calendarEventId: booking.calendarEventId,
                email: "system",
                tenant,
              }),
            });
          } catch (procError) {
            BookingLogger.apiError(
              "POST",
              "/api/close-processing",
              { calendarEventId: booking.calendarEventId, tenant },
              procError,
            );
          }
        }

        totalUpdatedCount++;
        allUpdatedBookingIds.push({ id: bookingId, tenant });
      }
    }

    const response = {
      message: isDryRun ? "Dry run completed" : "Auto-cancel unapproved completed",
      totalUpdatedCount,
      updatedBookingIds: allUpdatedBookingIds,
      dryRunResults: isDryRun ? dryRunResults : undefined,
      timestamp: new Date().toISOString(),
    };

    return NextResponse.json(response);
  } catch (error) {
    BookingLogger.apiError("GET", "/api/bookings/auto-cancel-unapproved", {}, error);

    return NextResponse.json(
      {
        message: "Internal Server Error",
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString(),
      },
      { status: 500 },
    );
  }
}

