import { extractTenantFromCollectionName } from "@/components/src/policy";
import { Booking } from "@/components/src/types";
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
      "/api/bookings/auto-checkout",
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
    // Calculate the time 24 hours ago in Eastern Time
    // Use explicit timezone conversion instead of relying on server timezone
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

    // Process each tenant collection
    for (const collectionName of TENANT_COLLECTIONS) {
      const tenant = extractTenantFromCollectionName(collectionName);

      BookingLogger.apiRequest("GET", "/api/bookings/auto-checkout", {
        tenant,
        collection: collectionName,
      });

      // Fetch bookings from the last 24 hours whose endDate has passed
      // We will filter for missing checkedOutAt in the code later
      const bookingsSnapshot = await db
        .collection(collectionName)
        .where("endDate", ">=", twentyFourHoursAgoTimestamp)
        .where("endDate", "<=", nowTimestamp)
        // .where('checkedOutAt', '==', null) // Removed this filter - will apply in code
        .get();

      if (bookingsSnapshot.empty) {
        BookingLogger.debug("No eligible bookings found for auto-checkout", {
          tenant,
          collection: collectionName,
          criteria: "endDate in last 24 hours and in the past",
        });
        continue; // Continue to next tenant collection
      }

      const batch = db.batch();
      let updatedCount = 0;
      const updatedBookingIds: string[] = []; // Array to store IDs

      // All tenants now use XState

      for (const doc of bookingsSnapshot.docs) {
        const booking = doc.data() as Booking;
        const bookingId = doc.id;

        // Check XState status for eligible bookings
        let shouldAutoCheckout = false;

        if (booking.xstateData) {
          // Check if booking is in "Checked In" state using common helper
          const { hasXStateValue, getXStateValue } = await import(
            "@/components/src/utils/xstateHelpers"
          );
          shouldAutoCheckout = hasXStateValue(booking, "Checked In");
          const currentXStateValue = getXStateValue(booking);

          BookingLogger.debug("XState auto-checkout eligibility check", {
            tenant,
            bookingId,
            xstateValue: currentXStateValue,
            shouldAutoCheckout,
          });
        } else {
          // Skip bookings without XState data
          BookingLogger.debug("Skipping booking without XState data", {
            tenant,
            bookingId,
            hasXStateData: false,
          });
          continue;
        }

        if (shouldAutoCheckout) {
          // Ensure endDate exists and is a Timestamp
          if (booking.endDate && booking.endDate instanceof Timestamp) {
            const endDate = booking.endDate.toDate();
            const endDatePlus30Min = new Date(
              endDate.getTime() + 30 * 60 * 1000,
            );

            // Check if current time is 30 minutes or more past the end date
            if (now >= endDatePlus30Min) {
              const checkoutReason = `XState: ${booking.xstateData?.snapshot?.value} → Checked Out`;

              if (isDryRun) {
                // Dry run: just collect the information
                BookingLogger.debug("DRY RUN: Would auto-checkout booking", {
                  tenant,
                  bookingId,
                  collection: collectionName,
                });
                dryRunResults.push({
                  id: bookingId,
                  tenant,
                  calendarEventId: booking.calendarEventId || "unknown",
                  xstateValue: booking.xstateData?.snapshot?.value,
                  reason: checkoutReason,
                });
              } else {
                // Actual run: perform the checkout via XState
                BookingLogger.debug("Auto-checkout via XState transition", {
                  calendarEventId: booking.calendarEventId,
                  tenant,
                  bookingId,
                });

                try {
                  if (booking.calendarEventId) {
                    // Call XState transition API to trigger checkout (same as user checkout)
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
                          eventType: "checkOut",
                          email: "System",
                          reason:
                            "Auto-checkout: 30 minutes after scheduled end time",
                        }),
                      },
                    );

                    if (!response.ok) {
                      const errorData = await response.json();
                      throw new Error(
                        errorData.error || "XState transition failed",
                      );
                    }

                    const xstateResult = await response.json();

                    BookingLogger.xstateTransition(
                      String(booking.xstateData?.snapshot?.value || "Unknown"),
                      String(xstateResult.newState),
                      "checkOut",
                      {
                        calendarEventId: booking.calendarEventId,
                        tenant,
                        reason: "auto-checkout",
                      },
                    );
                    updatedCount++;
                    updatedBookingIds.push(bookingId);
                  } else {
                    BookingLogger.warning(
                      "Auto-checkout skipped - no calendar event ID",
                      {
                        tenant,
                        bookingId,
                      },
                    );
                  }
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
            }
          }
        }
      }

      // Commit batch updates only for non-XState bookings (fallback cases)
      if (updatedCount > 0 && !isDryRun) {
        // Commit batch if there are any pending operations (fallback for non-XState bookings)
        try {
          await batch.commit();
          BookingLogger.dbOperation("BATCH COMMIT", "bookings", {
            tenant,
            note: "Committed fallback Firestore updates for non-XState bookings",
          });
        } catch (error) {
          // Batch might be empty, which is fine
          BookingLogger.debug("Batch commit skipped (no operations)", {
            tenant,
          });
        }

        BookingLogger.apiSuccess(
          "GET",
          "/api/bookings/auto-checkout",
          {
            tenant,
          },
          {
            processedCount: updatedCount,
            bookingIds: updatedBookingIds,
            note: "Auto-checkout completed via XState transitions",
          },
        );

        totalUpdatedCount += updatedCount;

        // Add to all updated booking IDs with tenant info
        updatedBookingIds.forEach(id => {
          allUpdatedBookingIds.push({ id, tenant });
        });
      } else if (!isDryRun) {
        BookingLogger.debug("No bookings met time criteria for auto-checkout", {
          tenant,
          collection: collectionName,
        });
      }
    }

    // Return response after processing all tenant collections
    if (isDryRun) {
      return NextResponse.json(
        {
          message: `🧪 DRY RUN COMPLETED - Found ${dryRunResults.length} bookings that would be auto-checked out`,
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
    } else if (totalUpdatedCount > 0) {
      return NextResponse.json(
        {
          message: `Successfully auto-checked out ${totalUpdatedCount} bookings across all tenants.`,
          mode: "production",
          updatedIds: allUpdatedBookingIds,
        },
        { status: 200 },
      );
    } else {
      BookingLogger.debug("No bookings met time criteria across all tenants", {
        processedTenants: TENANT_COLLECTIONS,
      });
      return NextResponse.json(
        {
          message: "No bookings met the time criteria for auto-checkout.",
          mode: "production",
        },
        { status: 200 },
      );
    }
  } catch (error) {
    BookingLogger.apiError("GET", "/api/bookings/auto-checkout", {}, error);
    // Check if error is an object and has a message property before accessing it
    const errorMessage =
      error instanceof Error ? error.message : "An unknown error occurred";
    return NextResponse.json(
      { message: "Internal Server Error", error: errorMessage },
      { status: 500 },
    );
  }
}
