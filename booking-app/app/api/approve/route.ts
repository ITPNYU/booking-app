import { NextRequest, NextResponse } from "next/server";

import { serverApproveBooking } from "@/components/src/server/admin";

export async function POST(req: NextRequest) {
  const { id, email } = await req.json();
  try {
    // Default approval behavior
    await serverApproveBooking(id, email);
    return NextResponse.json(
      { message: "Approved successfully" },
      { status: 200 },
    );
  } catch (error) {
    console.error("Error processing request for booking_id:", id, error);
    return NextResponse.json(
      { error: error.message },
      { status: error.status || 500 },
    );
  }
}
