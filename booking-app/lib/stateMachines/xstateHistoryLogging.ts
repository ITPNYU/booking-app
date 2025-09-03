import { BookingStatusLabel } from "@/components/src/types";

/**
 * Log booking status changes to History table
 */
export async function logBookingStatusChange(
  calendarEventId: string,
  status: BookingStatusLabel,
  changedBy: string,
  tenant?: string,
  note?: string
) {
  try {
    const { serverGetDataByCalendarEventId, logServerBookingChange } =
      await import("@/lib/firebase/server/adminDb");
    const { TableNames } = await import("@/components/src/policy");

    const doc = await serverGetDataByCalendarEventId<{
      id: string;
      requestNumber: number;
    }>(TableNames.BOOKING, calendarEventId, tenant);

    if (!doc) {
      console.error(
        `❌ BOOKING NOT FOUND FOR HISTORY LOG [${tenant?.toUpperCase() || "UNKNOWN"}]:`,
        { calendarEventId }
      );
      return;
    }

    await logServerBookingChange(
      doc.id,
      calendarEventId,
      status,
      changedBy,
      doc.requestNumber,
      tenant,
      note || `XState transition to ${status}`
    );

    console.log(
      `📝 XSTATE HISTORY LOGGED [${tenant?.toUpperCase() || "UNKNOWN"}]:`,
      {
        bookingId: doc.id,
        calendarEventId,
        status,
        changedBy,
        requestNumber: doc.requestNumber,
        note: note || `XState transition to ${status}`,
      }
    );
  } catch (error) {
    console.error(
      `❌ XSTATE HISTORY LOG ERROR [${tenant?.toUpperCase() || "UNKNOWN"}]:`,
      {
        calendarEventId,
        status,
        changedBy,
        error,
      }
    );
  }
}
