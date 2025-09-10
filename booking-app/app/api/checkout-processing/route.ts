import { processCheckoutBooking } from "@/components/src/server/db";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { calendarEventId, email, tenant } = await req.json();

    if (!calendarEventId || !email) {
      return NextResponse.json(
        { error: "Missing required fields: calendarEventId, email" },
        { status: 400 },
      );
    }

    console.log(
      `🎯 CHECKOUT PROCESSING API REQUEST [${tenant?.toUpperCase() || "UNKNOWN"}]:`,
      {
        calendarEventId,
        email,
        tenant,
      },
    );

    await processCheckoutBooking(calendarEventId, email, tenant);

    console.log(
      `✅ CHECKOUT PROCESSING API SUCCESS [${tenant?.toUpperCase() || "UNKNOWN"}]:`,
      {
        calendarEventId,
        email,
      },
    );

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error(`🚨 CHECKOUT PROCESSING API ERROR:`, {
      error: error.message,
      stack: error.stack,
    });

    return NextResponse.json(
      { error: "Internal server error", details: error.message },
      { status: 500 },
    );
  }
}
