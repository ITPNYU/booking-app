import { DEFAULT_TENANT } from "@/components/src/constants/tenants";
import { TableNames } from "@/components/src/policy";
import { BookingStatusLabel } from "@/components/src/types";
import {
  getLatestBookingStatusLogs,
  serverFetchAllDataFromCollection,
} from "@/lib/firebase/server/adminDb";
import { requireSession } from "@/lib/api/requireSession";
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

const emailEq = (emailLower: string) => ({
  field: "email",
  operator: "==" as const,
  value: emailLower,
});

async function isStaffAuthorizedForTenantLogs(
  emailLower: string,
  tenant: string,
): Promise<boolean> {
  const superMatch = await serverFetchAllDataFromCollection<{
    email?: string;
  }>(TableNames.SUPER_ADMINS, [emailEq(emailLower)], undefined, 1);
  if (
    superMatch.some((u) => u.email?.trim().toLowerCase() === emailLower)
  ) {
    return true;
  }

  const rightsMatch = await serverFetchAllDataFromCollection<{
    email?: string;
    isAdmin?: boolean;
    isWorker?: boolean;
  }>(TableNames.USERS_RIGHTS, [emailEq(emailLower)], tenant, 1);
  const rights = rightsMatch[0];
  if (
    rights &&
    rights.email?.trim().toLowerCase() === emailLower &&
    (rights.isAdmin === true || rights.isWorker === true)
  ) {
    return true;
  }

  const approverMatch = await serverFetchAllDataFromCollection<{
    email?: string;
  }>(TableNames.APPROVERS, [emailEq(emailLower)], tenant, 1);
  return approverMatch.some(
    (a) => a.email?.trim().toLowerCase() === emailLower,
  );
}

export async function POST(req: NextRequest) {
  try {
    const { bookings } = await req.json();
    const tenant = req.headers.get("x-tenant") || DEFAULT_TENANT;

    if (!shouldBypassAuth()) {
      const session = await requireSession();
      if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      const allowed = await isStaffAuthorizedForTenantLogs(
        session.email,
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
