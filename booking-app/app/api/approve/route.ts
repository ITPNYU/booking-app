import { NextRequest, NextResponse } from "next/server";

import { serverApproveBooking } from "@/components/src/server/admin";

export async function POST(req: NextRequest) {
  const { id, email } = await req.json();

  // Get tenant from x-tenant header, fallback to 'mc' as default
  const tenant = req.headers.get("x-tenant") || "mc";

  try {
    // Pass tenant to approval behavior
    await serverApproveBooking(id, email, tenant);
    return NextResponse.json(
      { message: "Approved successfully" },
      { status: 200 },
    );
  } catch (error) {
    console.error(
      "Error processing request for booking_id:",
      id,
      "tenant:",
      tenant,
      error,
    );
    return NextResponse.json(
      { error: error.message },
      { status: error.status || 500 },
    );
  }
}
