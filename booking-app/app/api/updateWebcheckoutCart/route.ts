import {
  DEFAULT_TENANT,
  isValidTenant,
} from "@/components/src/constants/tenants";
import { TableNames } from "@/components/src/policy";
import { canAccessWebCheckoutCart } from "@/components/src/utils/bookingMemoAccess";
import { resolveCallerRole } from "@/lib/api/authz";
import { getDetailsModalConfig } from "@/lib/api/bookingRedaction";
import { resolveCollectionName } from "@/lib/api/firestoreServer";
import { requireSession } from "@/lib/api/requireSession";
import admin from "@/lib/firebase/server/firebaseAdmin";

import { NextRequest, NextResponse } from "next/server";

/**
 * Sets `webcheckoutCartNumber` on a booking, looked up by calendarEventId. The
 * tenant schema's `detailsModal.showWebCheckout` must be on and the caller's
 * session role must satisfy `detailsModal.webCheckoutEditRoles`.
 *
 * Writes go straight to firebase-admin rather than through
 * `serverUpdateInFirestore`, which swallows update errors; a failed write must
 * surface as a 500 so the client does not mark the cart number as saved.
 */
export async function POST(req: NextRequest) {
  const session = await requireSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { calendarEventId, cartNumber } = await req.json();

    // Get tenant from x-tenant header, fallback to default tenant
    const tenant = req.headers.get("x-tenant") || DEFAULT_TENANT;
    if (!isValidTenant(tenant)) {
      return NextResponse.json({ error: "Invalid tenant" }, { status: 400 });
    }

    if (!calendarEventId) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 },
      );
    }

    const detailsModal = await getDetailsModalConfig(tenant);
    if (!detailsModal.showWebCheckout) {
      return NextResponse.json(
        { error: "WebCheckout is not enabled for this tenant" },
        { status: 403 },
      );
    }
    const role = await resolveCallerRole(session, tenant);
    if (!canAccessWebCheckoutCart(detailsModal, role, "edit")) {
      return NextResponse.json(
        {
          error:
            "Unauthorized: your role cannot update cart numbers for this tenant",
        },
        { status: 403 },
      );
    }

    // Update the cart number on the booking found by calendarEventId. Any
    // Firestore error falls through to the 500 below.
    const collectionName = resolveCollectionName(TableNames.BOOKING, tenant);
    const snapshot = await admin
      .firestore()
      .collection(collectionName)
      .where("calendarEventId", "==", calendarEventId)
      .limit(1)
      .get();
    if (snapshot.empty) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }
    await snapshot.docs[0].ref.update({
      webcheckoutCartNumber: cartNumber || null,
    });

    // Update the calendar event description with the new cart number via API
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"}/api/calendarEvents`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            "x-tenant": tenant,
          },
          body: JSON.stringify({
            calendarEventId,
            newValues: {}, // Empty object since description is automatically updated based on booking contents
          }),
        },
      );

      if (!response.ok) {
        throw new Error(
          `Calendar API responded with status: ${response.status}`,
        );
      }

      console.log(
        `Updated calendar event ${calendarEventId} with cart number: ${cartNumber}`,
      );
    } catch (calendarError) {
      console.error("Error updating calendar event:", calendarError);
      // Don't fail the whole request if calendar update fails
    }

    return NextResponse.json({
      success: true,
      message: "Cart number updated successfully",
    });
  } catch (error) {
    console.error("Error updating cart number:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
