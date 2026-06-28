import { getOAuth2Client } from "@/lib/googleClient";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");

  if (!code) {
    return NextResponse.json(
      { error: "Missing code parameter" },
      { status: 400 },
    );
  }

  const oauth2Client = await getOAuth2Client();
  const { tokens } = await oauth2Client.getToken(code);
  return NextResponse.json(tokens, { status: 200 });
}
