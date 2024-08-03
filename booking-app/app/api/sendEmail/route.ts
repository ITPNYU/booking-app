import { NextRequest, NextResponse } from "next/server";

import { sendHTMLEmail } from "@/app/lib/sendHTMLEmail";

export async function POST(req: NextRequest) {
  const {
    templateName,
    contents,
    targetEmail,
    status,
    eventTitle,
    bodyMessage,
  } = await req.json();

  // if (!templateName || !contents || !targetEmail || !status || !eventTitle) {
  //  return NextResponse.json(
  //    { error: "Missing required fields" },
  //    { status: 400 }
  //  );
  // }

  try {
    await sendHTMLEmail({
      templateName,
      contents,
      targetEmail,
      status,
      eventTitle,
      body: bodyMessage || "",
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
