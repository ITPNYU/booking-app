import { processCloseBooking } from "@/components/src/server/db";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { calendarEventId, email, tenant } = await req.json();

    if (!calendarEventId || !email || !tenant) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 },
      );
    }

    console.log(
      `🔄 CLOSE PROCESSING API CALLED [${tenant?.toUpperCase() || "UNKNOWN"}]:`,
      {
        calendarEventId,
        email,
        tenant,
      },
    );

    await processCloseBooking(calendarEventId, email, tenant);

    console.log(
      `✅ CLOSE PROCESSING API SUCCESS [${tenant?.toUpperCase() || "UNKNOWN"}]:`,
      {
        calendarEventId,
        email,
      },
    );

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error(`🚨 CLOSE PROCESSING API ERROR:`, {
      error: error.message,
      stack: error.stack,
    });

    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
