import { DEFAULT_TENANT } from "@/components/src/constants/tenants";
import { TableNames } from "@/components/src/policy";
import { BookingStatusLabel } from "@/components/src/types";
import {
  getLatestBookingStatusLogs,
  serverFetchAllDataFromCollection,
} from "@/lib/firebase/server/adminDb";
import admin from "@/lib/firebase/server/firebaseAdmin";
import { shouldBypassAuth } from "@/lib/utils/testEnvironment";
import { NextRequest, NextResponse } from "next/server";

const MAX_BOOKING_LOG_BATCH_SIZE = 500;

type BookingLogRequest = {
  calendarEventId?: unknown;
  status?: unknown;
};

function isBookingLogRequest(
  request: BookingLogRequest,
): request is { calendarEventId: string; status: BookingStatusLabel } {
  return (
    typeof request.calendarEventId === "string" &&
    request.calendarEventId.length > 0 &&
    typeof request.status === "string" &&
    Object.values(BookingStatusLabel).includes(
      request.status as BookingStatusLabel,
    )
  );
}

async function getVerifiedEmailLower(
  request: NextRequest,
): Promise<string | null> {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  const idToken = authHeader.slice(7);
  try {
    const decoded = await admin.auth().verifyIdToken(idToken);
    const email = decoded.email?.trim().toLowerCase();
    return email && email.length > 0 ? email : null;
  } catch {
    return null;
  }
}

async function isStaffAuthorizedForTenantLogs(
  emailLower: string,
  tenant: string,
): Promise<boolean> {
  const [superAdmins, usersRights, approvers] = await Promise.all([
    serverFetchAllDataFromCollection<{ email?: string }>(
      TableNames.SUPER_ADMINS,
      [],
    ),
    serverFetchAllDataFromCollection<{
      email?: string;
      isAdmin?: boolean;
      isWorker?: boolean;
    }>(TableNames.USERS_RIGHTS, [], tenant),
    serverFetchAllDataFromCollection<{ email?: string }>(
      TableNames.APPROVERS,
      [],
      tenant,
    ),
  ]);

  if (
    superAdmins.some((u) => u.email?.trim().toLowerCase() === emailLower)
  ) {
    return true;
  }

  if (
    usersRights.some(
      (u) =>
        u.email?.trim().toLowerCase() === emailLower &&
        (u.isAdmin === true || u.isWorker === true),
    )
  ) {
    return true;
  }

  return approvers.some(
    (a) => a.email?.trim().toLowerCase() === emailLower,
  );
}

export async function POST(req: NextRequest) {
  try {
    const { bookings } = await req.json();
    const tenant = req.headers.get("x-tenant") || DEFAULT_TENANT;

    if (!shouldBypassAuth()) {
      const emailLower = await getVerifiedEmailLower(req);
      if (!emailLower) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      const allowed = await isStaffAuthorizedForTenantLogs(
        emailLower,
        tenant,
      );
      if (!allowed) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    if (!Array.isArray(bookings)) {
      return NextResponse.json(
        { error: "bookings must be an array" },
        { status: 400 },
      );
    }

    if (bookings.length > MAX_BOOKING_LOG_BATCH_SIZE) {
      return NextResponse.json(
        {
          error: `booking log batch size must be ${MAX_BOOKING_LOG_BATCH_SIZE} or fewer`,
        },
        { status: 413 },
      );
    }

    const validBookings = bookings.filter(isBookingLogRequest);
    if (validBookings.length !== bookings.length) {
      return NextResponse.json(
        {
          error: "Each booking must include a valid calendarEventId and status",
        },
        { status: 400 },
      );
    }

    const latestLogs = await getLatestBookingStatusLogs(validBookings, tenant);
    return NextResponse.json(latestLogs, { status: 200 });
  } catch (error) {
    console.error("Error fetching latest booking logs:", error);
    return NextResponse.json(
      { error: "Failed to fetch latest booking logs" },
      { status: 500 },
    );
  }
}
