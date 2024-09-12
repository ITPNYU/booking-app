import { NextRequest, NextResponse } from "next/server";

import { serverApproveBooking } from "@/components/src/server/admin";

export async function POST(req: NextRequest) {
  const { id } = await req.json();

  try {
    console.log("id", id);
    await serverApproveBooking(id);
    return NextResponse.json(
      { message: "Approved successfully" },
      { status: 200 },
    );
  } catch (error) {
    console.error(`booking_id: ${id} Error approving:`, error);
    return NextResponse.json(
      { error: `Failed to approve booking. id: ${id}` },
      { status: 500 },
    );
  }
}