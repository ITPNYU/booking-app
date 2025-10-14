import { getTestEnvironmentStatus } from "@/lib/utils/testEnvironment";
import { NextResponse } from "next/server";

export const GET = async () => {
  try {
    const testStatus = getTestEnvironmentStatus();
    return NextResponse.json(testStatus);
  } catch (error) {
    console.error("Error in isTestEnv API:", error);
    return NextResponse.json({ isOnTestEnv: false });
  }
};
