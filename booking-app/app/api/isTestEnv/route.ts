import { NextResponse } from "next/server";

export async function GET() {
  try {
    if(process.env.NEXT_PUBLIC_BRANCH_NAME === "development" && process.env.CI === "true") {
      return NextResponse.json({ isOnTestEnv: true });
    }
  } catch (error) {
  }

  return NextResponse.json({ isOnTestEnv: false });
}