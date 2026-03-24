import { extractTenantFromCollectionName } from "@/components/src/policy";
import { Booking } from "@/components/src/types";
import admin from "@/lib/firebase/server/firebaseAdmin";
import { BookingLogger } from "@/lib/logger/bookingLogger";
import { Timestamp } from "firebase-admin/firestore";
import { NextRequest, NextResponse } from "next/server";

const db = admin.firestore();

// Only ITP uses auto-checkin
const TENANT_COLLECTIONS = ["itp-bookings"];

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
      "/api/bookings/auto-checkin",
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

  const token = authHeader.substring(7);

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
      mode: "dry-run",
      candidateBookings: [],
      summary: { totalCandidates: 0, byTenant: {} },
    });
  }

  try {
    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const twentyFourHoursAgoTimestamp = Timestamp.fromDate(twentyFourHoursAgo);
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

      BookingLogger.apiRequest("GET", "/api/bookings/auto-checkin", {
        tenant,
        collection: collectionName,
      });

      // Fetch bookings whose startDate has passed (within last 24 hours)
      const bookingsSnapshot = await db
        .collection(collectionName)
        .where("startDate", ">=", twentyFourHoursAgoTimestamp)
        .where("startDate", "<=", nowTimestamp)
        .get();

      if (bookingsSnapshot.empty) {
        BookingLogger.debug("No eligible bookings found for auto-checkin", {
          tenant,
          collection: collectionName,
          criteria: "startDate in last 24 hours and in the past",
        });
        continue;
      }

      let updatedCount = 0;
      const updatedBookingIds: string[] = [];

      for (const doc of bookingsSnapshot.docs) {
        const booking = doc.data() as Booking;
        const bookingId = doc.id;

        // Check XState status: only auto-checkin "Approved" bookings
        if (!booking.xstateData) {
          BookingLogger.debug("Skipping booking without XState data", {
            tenant,
            bookingId,
            hasXStateData: false,
          });
          continue;
        }

        const { hasXStateValue, getXStateValue } = await import(
          "@/components/src/utils/xstateHelpers"
        );
        const isApproved = hasXStateValue(booking, "Approved");
        const currentXStateValue = getXStateValue(booking);

        BookingLogger.debug("XState auto-checkin eligibility check", {
          tenant,
          bookingId,
          xstateValue: currentXStateValue,
          isApproved,
        });

        if (!isApproved) {
          continue;
        }

        // Ensure startDate exists and has passed
        if (!(booking.startDate && booking.startDate instanceof Timestamp)) {
          continue;
        }

        const startDate = booking.startDate.toDate();

        // Auto-checkin when current time is past the start date
        if (now < startDate) {
          continue;
        }

        const checkinReason = `XState: ${currentXStateValue} → Checked In`;

        if (isDryRun) {
          BookingLogger.debug("DRY RUN: Would auto-checkin booking", {
            tenant,
            bookingId,
            collection: collectionName,
          });
          dryRunResults.push({
            id: bookingId,
            tenant,
            calendarEventId: booking.calendarEventId || "unknown",
            xstateValue: currentXStateValue,
            reason: checkinReason,
          });
          continue;
        }

        // Perform the checkin via XState
        BookingLogger.debug("Auto-checkin via XState transition", {
          calendarEventId: booking.calendarEventId,
          tenant,
          bookingId,
        });

        try {
          if (!booking.calendarEventId) {
            BookingLogger.warning(
              "Auto-checkin skipped - no calendar event ID",
              { tenant, bookingId },
            );
            continue;
          }

          // Call XState transition API to trigger checkin
          const response = await fetch(
            `${process.env.NEXT_PUBLIC_BASE_URL}/api/xstate-transition`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "x-tenant": tenant,
              },
              body: JSON.stringify({
                calendarEventId: booking.calendarEventId,
                eventType: "checkIn",
                email: "System",
                reason:
                  "Auto-checkin: booking start time has passed",
              }),
            },
          );

          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || "XState transition failed");
          }

          const xstateResult = await response.json();

          BookingLogger.xstateTransition(
            String(currentXStateValue || "Unknown"),
            String(xstateResult.newState),
            "checkIn",
            {
              calendarEventId: booking.calendarEventId,
              tenant,
              reason: "auto-checkin",
            },
          );

          // Call checkin-processing API for side effects (email, calendar, history)
          try {
            await fetch(
              `${process.env.NEXT_PUBLIC_BASE_URL}/api/checkin-processing`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  calendarEventId: booking.calendarEventId,
                  email: "System",
                  tenant,
                }),
              },
            );
          } catch (procError) {
            BookingLogger.apiError(
              "POST",
              "/api/checkin-processing",
              { calendarEventId: booking.calendarEventId, tenant },
              procError,
            );
          }

          updatedCount++;
          updatedBookingIds.push(bookingId);
        } catch (error) {
          BookingLogger.apiError(
            "POST",
            "/api/xstate-transition",
            {
              calendarEventId: booking.calendarEventId,
              tenant,
              bookingId,
            },
            error,
          );
        }
      }

      if (updatedCount > 0 && !isDryRun) {
        BookingLogger.apiSuccess(
          "GET",
          "/api/bookings/auto-checkin",
          { tenant },
          {
            processedCount: updatedCount,
            bookingIds: updatedBookingIds,
            note: "Auto-checkin completed via XState transitions",
          },
        );

        totalUpdatedCount += updatedCount;
        updatedBookingIds.forEach((id) => {
          allUpdatedBookingIds.push({ id, tenant });
        });
      } else if (!isDryRun) {
        BookingLogger.debug(
          "No bookings met time criteria for auto-checkin",
          { tenant, collection: collectionName },
        );
      }
    }

    if (isDryRun) {
      return NextResponse.json(
        {
          message: `🧪 DRY RUN COMPLETED - Found ${dryRunResults.length} bookings that would be auto-checked in`,
          mode: "dry-run",
          candidateBookings: dryRunResults,
          summary: {
            totalCandidates: dryRunResults.length,
            byTenant: dryRunResults.reduce(
              (acc, booking) => {
                acc[booking.tenant] = (acc[booking.tenant] || 0) + 1;
                return acc;
              },
              {} as Record<string, number>,
            ),
          },
        },
        { status: 200 },
      );
    }

    if (totalUpdatedCount > 0) {
      return NextResponse.json(
        {
          message: `Successfully auto-checked in ${totalUpdatedCount} bookings.`,
          mode: "production",
          updatedIds: allUpdatedBookingIds,
        },
        { status: 200 },
      );
    }

    BookingLogger.debug("No bookings met time criteria for auto-checkin", {
      processedTenants: TENANT_COLLECTIONS,
    });
    return NextResponse.json(
      {
        message: "No bookings met the time criteria for auto-checkin.",
        mode: "production",
      },
      { status: 200 },
    );
  } catch (error) {
    BookingLogger.apiError("GET", "/api/bookings/auto-checkin", {}, error);
    const errorMessage =
      error instanceof Error ? error.message : "An unknown error occurred";
    return NextResponse.json(
      { message: "Internal Server Error", error: errorMessage },
      { status: 500 },
    );
  }
}
