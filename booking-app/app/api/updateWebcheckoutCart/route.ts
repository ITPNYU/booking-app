import { DEFAULT_TENANT } from "@/components/src/constants/tenants";
import { TableNames } from "@/components/src/policy";
import { serverUpdateDataByCalendarEventId } from "@/components/src/server/admin";
import { serverFetchAllDataFromCollection } from "@/lib/firebase/server/adminDb";

import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { calendarEventId, cartNumber, userEmail } = await req.json();

    // Get tenant from x-tenant header, fallback to default tenant
    const tenant = req.headers.get("x-tenant") || DEFAULT_TENANT;

    if (!calendarEventId || !userEmail) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 },
      );
    }

    // Check if user has PA or Admin permissions
    const [adminUsers, paUsers] = await Promise.all([
      serverFetchAllDataFromCollection(TableNames.ADMINS),
      serverFetchAllDataFromCollection(TableNames.PAS),
    ]);

    const adminEmails = adminUsers.map((admin: any) => admin.email);
    const paEmails = paUsers.map((pa: any) => pa.email);

    const isAuthorized =
      adminEmails.includes(userEmail) || paEmails.includes(userEmail);

    if (!isAuthorized) {
      return NextResponse.json(
        {
          error:
            "Unauthorized: Only PA and Admin users can update cart numbers",
        },
        { status: 403 },
      );
    }

    // Update the cart number in the database using calendarEventId
    await serverUpdateDataByCalendarEventId(
      TableNames.BOOKING,
      calendarEventId,
      {
        webcheckoutCartNumber: cartNumber || null,
      },
      tenant,
    );

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
            calendarEventId: calendarEventId,
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
