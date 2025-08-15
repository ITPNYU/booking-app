import { DEFAULT_TENANT } from "@/components/src/constants/tenants";
import { NextRequest, NextResponse } from "next/server";

import { serverSendBookingDetailEmail } from "@/components/src/server/admin";

export async function POST(req: NextRequest) {
  const { calendarEventId, email, headerMessage, status } = await req.json();

  // Get tenant from x-tenant header, fallback to default tenant
  const tenant = req.headers.get("x-tenant") || DEFAULT_TENANT;

  // if (!templateName || !contents || !targetEmail || !status || !eventTitle) {
  //  return NextResponse.json(
  //    { error: "Missing required fields" },
  //    { status: 400 }
  //  );
  // }

  try {
    serverSendBookingDetailEmail({
      calendarEventId,
      targetEmail: email,
      headerMessage,
      status,
      tenant,
    });
    return NextResponse.json(
      { message: "Email sent successfully" },
      { status: 200 },
    );
  } catch (error) {
    console.error("Error sending email:", error);
    return NextResponse.json(
      { error: "Failed to send email" },
      { status: 500 },
    );
  }
}
