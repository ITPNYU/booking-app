import { TableNames } from "@/components/src/policy";
import {
  serverFetchAllDataFromCollection,
  serverUpdateInFirestore,
} from "@/lib/firebase/server/adminDb";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { calendarEventId, cartNumber, userEmail } = await req.json();

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

    // Update the cart number in the database
    await serverUpdateInFirestore(TableNames.BOOKING, calendarEventId, {
      webcheckoutCartNumber: cartNumber || null,
    });

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
