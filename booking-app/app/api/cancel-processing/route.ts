import { processCancelBooking } from "@/components/src/server/db";
import { NextRequest } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { calendarEventId, email, netId, tenant } = await req.json();

    console.log(
      `🔄 CANCEL PROCESSING API CALLED [${tenant?.toUpperCase() || "UNKNOWN"}]:`,
      {
        calendarEventId,
        email,
        netId,
        tenant,
      },
    );

    // Call the shared cancel processing function
    await processCancelBooking(calendarEventId, email, netId, tenant);

    console.log(
      `✅ CANCEL PROCESSING API SUCCESS [${tenant?.toUpperCase() || "UNKNOWN"}]:`,
      {
        calendarEventId,
        email,
        netId,
      },
    );

    return Response.json({ success: true });
  } catch (error) {
    console.error(`🚨 CANCEL PROCESSING API ERROR:`, {
      error: error.message,
      stack: error.stack,
    });

    return Response.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
