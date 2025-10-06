import { DEFAULT_TENANT } from "@/components/src/constants/tenants";
import { BookingStatusLabel } from "@/components/src/types";
import {
  getBookingLogs,
  logServerBookingChange,
} from "@/lib/firebase/server/adminDb";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const requestNumber = searchParams.get("requestNumber");

    if (!requestNumber) {
      return NextResponse.json(
        { error: "requestNumber parameter is required" },
        { status: 400 },
      );
    }

    const logs = await getBookingLogs(parseInt(requestNumber));
    return NextResponse.json(logs, { status: 200 });
  } catch (error) {
    console.error("Error fetching booking logs:", error);
    return NextResponse.json(
      { error: "Failed to fetch booking logs" },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const {
      bookingId,
      calendarEventId,
      status,
      changedBy,
      requestNumber,
      note,
    } = await req.json();
    // Get tenant from x-tenant header, fallback to default tenant
    const tenant = req.headers.get("x-tenant") || DEFAULT_TENANT;

    if (!bookingId || !status || !changedBy || !requestNumber) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 },
      );
    }

    await logServerBookingChange({
      bookingId,
      calendarEventId,
      status: status as BookingStatusLabel,
      changedBy,
      requestNumber,
      note,
      tenant,
    });

    return NextResponse.json(
      { message: "Booking log created successfully" },
      { status: 200 },
    );
  } catch (error) {
    console.error("Error creating booking log:", error);
    return NextResponse.json(
      { error: "Failed to create booking log" },
      { status: 500 },
    );
  }
}
