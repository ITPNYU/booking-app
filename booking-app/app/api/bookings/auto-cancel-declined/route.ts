import type { SchemaContextType } from "@/components/src/client/routes/components/SchemaProvider";
import { extractTenantFromCollectionName, TableNames } from "@/components/src/policy";
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

export async function GET(request: NextRequest) {
  // Check for dry run mode
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
      "/api/bookings/auto-cancel-declined",
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

  try {
    const now = new Date();
    let totalUpdatedCount = 0;
    const allUpdatedBookingIds: { id: string; tenant: string }[] = [];
    const dryRunResults: {
      id: string;
      tenant: string;
      calendarEventId: string;
      xstateValue?: string;
      reason: string;
    }[] = [];

    // Process each tenant collection
    for (const collectionName of TENANT_COLLECTIONS) {
      const tenant = extractTenantFromCollectionName(collectionName);

      BookingLogger.apiRequest("GET", "/api/bookings/auto-cancel-declined", {
        tenant,
        collection: collectionName,
      });

      // Fetch tenant schema to get declinedGracePeriod (default: 24 hours)
      const schema = await serverGetDocumentById<SchemaContextType>(
        TableNames.TENANT_SCHEMA,
        tenant,
      );
      const gracePeriodHours = schema?.declinedGracePeriod ?? 24;
      const gracePeriodMs = gracePeriodHours * 60 * 60 * 1000;
      const gracePeriodAgo = new Date(now.getTime() - gracePeriodMs);
      const gracePeriodAgoTimestamp = Timestamp.fromDate(gracePeriodAgo);

      BookingLogger.debug("Using grace period from schema", {
        tenant,
        gracePeriodHours,
        gracePeriodAgo: gracePeriodAgo.toISOString(),
      });

      // Fetch DECLINED bookings that were declined more than grace period ago
      const bookingsSnapshot = await db
        .collection(collectionName)
        .where("declinedAt", "<=", gracePeriodAgoTimestamp)
        .get();

      if (bookingsSnapshot.empty) {
        BookingLogger.debug(
          "No eligible DECLINED bookings found for auto-cancel",
          {
            tenant,
            collection: collectionName,
            criteria: `declinedAt more than ${gracePeriodHours} hours ago`,
          },
        );
        continue; // Continue to next tenant collection
      }

      const batch = db.batch();
      let updatedCount = 0;
      const updatedBookingIds: string[] = [];

      // Process each booking
      for (const doc of bookingsSnapshot.docs) {
        const booking = doc.data() as Booking;
        const bookingId = doc.id;

        // Skip if already canceled
        if (booking.canceledAt) {
          BookingLogger.debug("Skipping already canceled booking", {
            bookingId,
            calendarEventId: booking.calendarEventId,
            tenant,
          });
          continue;
        }

        // Skip if not declined
        if (!booking.declinedAt) {
          BookingLogger.debug("Skipping non-declined booking", {
            bookingId,
            calendarEventId: booking.calendarEventId,
            tenant,
          });
          continue;
        }

        // Verify the booking is actually in DECLINED status (not just has declinedAt timestamp)
        // A booking could have been declined, then edited/approved, so we need to check current status
        const currentStatus = getStatusFromXState(booking, tenant);
        if (currentStatus !== BookingStatusLabel.DECLINED) {
          BookingLogger.debug("Skipping booking not in DECLINED status", {
            bookingId,
            calendarEventId: booking.calendarEventId,
            tenant,
            currentStatus,
            declinedAt: booking.declinedAt,
            note: "Booking has declinedAt timestamp but is not currently in DECLINED status (may have been edited/approved)",
          });
          continue;
        }

        if (isDryRun) {
          // For dry run, just log what would be done
          dryRunResults.push({
            id: bookingId,
            tenant,
            calendarEventId: booking.calendarEventId,
            xstateValue: booking.xstateData?.value,
            reason: `Would auto-cancel DECLINED booking after ${gracePeriodHours} hours`,
          });
          continue;
        }

        try {
          // Use XState transition to cancel the booking
          const xstateResult = await callXStateTransitionAPI(
            booking.calendarEventId,
            "cancel",
            "system", // System identifier for automated actions
            tenant,
            `Auto-canceled after ${gracePeriodHours}-hour grace period expired`,
          );

          if (xstateResult.success) {
            BookingLogger.statusChange(
              "DECLINED",
              "CANCELED",
              {
                bookingId,
                calendarEventId: booking.calendarEventId,
                tenant,
              },
              `Auto-canceled after ${gracePeriodHours}-hour grace period`,
            );

            updatedBookingIds.push(bookingId);
            updatedCount++;
            totalUpdatedCount++;
            allUpdatedBookingIds.push({ id: bookingId, tenant });
          } else {
            BookingLogger.xstateError(
              "Failed to auto-cancel DECLINED booking",
              {
                bookingId,
                calendarEventId: booking.calendarEventId,
                tenant,
              },
              new Error(xstateResult.error),
            );
          }
        } catch (error) {
          BookingLogger.apiError(
            "GET",
            "/api/bookings/auto-cancel-declined",
            {
              bookingId,
              calendarEventId: booking.calendarEventId,
              tenant,
            },
            error,
          );
        }
      }

      // Commit the batch if not in dry run mode
      if (!isDryRun && updatedCount > 0) {
        await batch.commit();
        BookingLogger.dbSuccess("Auto-cancel batch committed", collectionName, {
          tenant,
          updatedCount,
          updatedBookingIds,
        });
      }
    }

    const response = {
      message: isDryRun ? "Dry run completed" : "Auto-cancel completed",
      totalUpdatedCount,
      updatedBookingIds: allUpdatedBookingIds,
      dryRunResults: isDryRun ? dryRunResults : undefined,
      timestamp: new Date().toISOString(),
    };

    BookingLogger.apiSuccess(
      "GET",
      "/api/bookings/auto-cancel-declined",
      {
        totalUpdatedCount,
        isDryRun,
      },
      response,
    );

    return NextResponse.json(response);
  } catch (error) {
    BookingLogger.apiError(
      "GET",
      "/api/bookings/auto-cancel-declined",
      {},
      error,
    );

    return NextResponse.json(
      {
        message: "Internal Server Error",
        error: error.message,
        timestamp: new Date().toISOString(),
      },
      { status: 500 },
    );
  }
}
