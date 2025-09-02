import { DEFAULT_TENANT } from "@/components/src/constants/tenants";
import { NextRequest, NextResponse } from "next/server";

import { sendHTMLEmail } from "@/app/lib/sendHTMLEmail";

export async function POST(req: NextRequest) {
  const {
    templateName,
    contents,
    targetEmail,
    status,
    eventTitle,
    requestNumber,
    bodyMessage,
    approverType,
    replyTo,
    schemaName,
  } = await req.json();

  // Get tenant from x-tenant header for logging purposes
  const tenant = req.headers.get("x-tenant") || DEFAULT_TENANT;

  // if (!templateName || !contents || !targetEmail || !status || !eventTitle) {
  //  return NextResponse.json(
  //    { error: "Missing required fields" },
  //    { status: 400 }
  //  );
  // }

  try {
    console.log(
      `Sending email for tenant: ${tenant}, template: ${templateName}, to: ${targetEmail}`,
    );
    await sendHTMLEmail({
      templateName,
      contents,
      targetEmail,
      status,
      eventTitle,
      requestNumber,
      body: bodyMessage || "",
      approverType,
      replyTo,
      tenant,
      schemaName,
    });
    return NextResponse.json(
      { message: "Email sent successfully" },
      { status: 200 },
    );
  } catch (error) {
    console.error(`Error sending email for tenant: ${tenant}:`, error);
    return NextResponse.json(
      { error: "Failed to send email" },
      { status: 500 },
    );
  }
}
