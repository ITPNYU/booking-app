import { BookingStatusLabel } from "@/components/src/types";
import { logServerBookingChange } from "@/lib/firebase/server/adminDb";
import admin from "@/lib/firebase/server/firebaseAdmin";
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
    console.log("🧪 DRY RUN MODE ENABLED - No actual changes will be made");
  }

  // --- Authorization Check ---
  const expectedToken = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");

  if (!expectedToken) {
    // Log an error on the server if the secret isn't configured
    console.error("CRON_SECRET environment variable is not set.");
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
    // Calculate the time 24 hours ago
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
      console.log(`Processing collection: ${collectionName}`);

      // Fetch bookings from the last 24 hours whose endDate has passed
      // We will filter for missing checkedOutAt in the code later
      const bookingsSnapshot = await db
        .collection(collectionName)
        .where("endDate", ">=", twentyFourHoursAgoTimestamp)
        .where("endDate", "<=", nowTimestamp)
        // .where('checkedOutAt', '==', null) // Removed this filter - will apply in code
        .get();

      if (bookingsSnapshot.empty) {
        console.log(
          `No bookings found in ${collectionName} with endDate in the last 24 hours and in the past.`,
        );
        continue; // Continue to next tenant collection
      }

      const batch = db.batch();
      let updatedCount = 0;
      const updatedBookingIds: string[] = []; // Array to store IDs
      const tenant = collectionName.split("-")[0]; // Extract tenant from collection name

      // Import tenant utilities once
      const { shouldUseXState } = await import(
        "@/components/src/utils/tenantUtils"
      );
      const usesXState = shouldUseXState(tenant);

      for (const doc of bookingsSnapshot.docs) {
        const booking = doc.data();
        const bookingId = doc.id;

        // Filter in code: Check XState status for eligible bookings
        let shouldAutoCheckout = false;

        if (usesXState && booking.xstateData?.snapshot?.value) {
          // For XState tenants, check if booking is in "Checked In" state
          const xstateValue = booking.xstateData.snapshot.value;
          shouldAutoCheckout =
            typeof xstateValue === "string" && xstateValue === "Checked In";

          console.log(
            `🔍 XSTATE AUTO-CHECKOUT ELIGIBILITY CHECK [${tenant?.toUpperCase()}]:`,
            {
              bookingId,
              xstateValue,
              shouldAutoCheckout,
            },
          );
        } else {
          // For non-XState tenants or missing XState data, fall back to timestamp check
          shouldAutoCheckout =
            booking.checkedOutAt == null && booking.checkedInAt != null;

          console.log(
            `🔍 LEGACY AUTO-CHECKOUT ELIGIBILITY CHECK [${tenant?.toUpperCase()}]:`,
            {
              bookingId,
              hasCheckedInAt: !!booking.checkedInAt,
              hasCheckedOutAt: !!booking.checkedOutAt,
              shouldAutoCheckout,
            },
          );
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
              const checkoutReason = usesXState
                ? `XState: ${booking.xstateData?.snapshot?.value} → Checked Out`
                : `Legacy: checkedInAt exists, checkedOutAt missing`;

              if (isDryRun) {
                // Dry run: just collect the information
                console.log(
                  `🧪 DRY RUN: Would auto-checkout booking ${bookingId} in ${collectionName}`,
                );
                dryRunResults.push({
                  id: bookingId,
                  tenant,
                  calendarEventId: booking.calendarEventId || "unknown",
                  xstateValue: booking.xstateData?.snapshot?.value,
                  reason: checkoutReason,
                });
              } else {
                // Actual run: perform the checkout
                console.log(
                  `Auto-checking out booking ${bookingId} in ${collectionName}`,
                );
                const bookingRef = db.collection(collectionName).doc(bookingId);
                // Set checkedOutAt to the original endDate
                batch.update(bookingRef, { checkedOutAt: booking.endDate });
                updatedCount++;
                updatedBookingIds.push(bookingId); // Add ID to the list
              }
            }
          }
        }
      }

      if (updatedCount > 0 && !isDryRun) {
        await batch.commit();
        console.log(
          `Successfully auto-checked out ${updatedCount} bookings in ${collectionName}.`,
        );
        totalUpdatedCount += updatedCount;

        // Use the existing checkOut function for each booking
        for (const bookingId of updatedBookingIds) {
          try {
            const bookingDoc = await db
              .collection(collectionName)
              .doc(bookingId)
              .get();
            const bookingData = bookingDoc.data();
            if (bookingData && bookingData.calendarEventId) {
              console.log(
                `🎭 USING EXISTING CHECKOUT FUNCTION FOR AUTO-CHECKOUT [${tenant?.toUpperCase()}]:`,
                {
                  bookingId,
                  calendarEventId: bookingData.calendarEventId,
                  tenant,
                },
              );

              try {
                // Use the existing checkOut function which handles XState, history, and emails
                const { checkOut } = await import("@/components/src/server/db");
                await checkOut(
                  bookingData.calendarEventId,
                  "system-auto-checkout",
                  tenant,
                );

                console.log(
                  `✅ AUTO-CHECKOUT SUCCESS [${tenant?.toUpperCase()}]:`,
                  {
                    bookingId,
                    calendarEventId: bookingData.calendarEventId,
                  },
                );
              } catch (checkoutError) {
                console.error(
                  `🚨 AUTO-CHECKOUT FAILED [${tenant?.toUpperCase()}]:`,
                  {
                    bookingId,
                    calendarEventId: bookingData.calendarEventId,
                    error: checkoutError,
                  },
                );
                // Fall back to traditional logging if checkOut fails
                await logServerBookingChange({
                  bookingId,
                  status: BookingStatusLabel.CHECKED_OUT,
                  changedBy: "system-auto-checkout",
                  requestNumber: bookingData.requestNumber,
                  calendarEventId: bookingData.calendarEventId,
                  note: "Auto-checkout by system (checkOut function failed)",
                  tenant,
                });
              }
            }
          } catch (error) {
            console.error(
              `Error processing auto-checkout for booking ${bookingId} in ${collectionName}:`,
              error,
            );
          }
        }

        // Add to all updated booking IDs with tenant info
        updatedBookingIds.forEach(id => {
          allUpdatedBookingIds.push({ id, tenant });
        });
      } else if (!isDryRun) {
        console.log(
          `No bookings in ${collectionName} met the time criteria for auto-checkout.`,
        );
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
      console.log(
        "No bookings met the time criteria for auto-checkout across all tenants.",
      );
      return NextResponse.json(
        {
          message: "No bookings met the time criteria for auto-checkout.",
          mode: "production",
        },
        { status: 200 },
      );
    }
  } catch (error) {
    console.error("Error during auto-checkout process:", error);
    // Check if error is an object and has a message property before accessing it
    const errorMessage =
      error instanceof Error ? error.message : "An unknown error occurred";
    return NextResponse.json(
      { message: "Internal Server Error", error: errorMessage },
      { status: 500 },
    );
  }
}
