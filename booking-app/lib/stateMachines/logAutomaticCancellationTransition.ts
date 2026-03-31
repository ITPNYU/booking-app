type AutomaticCancellationReason = "no-show" | "decline";

type AutomaticCancellationContext = {
  automationReason?: string;
  calendarEventId?: string | null;
  tenant?: string;
};

type AutomaticCancellationBooking = {
  requestNumber?: number;
};

const AUTOMATIC_CANCELLATION_NOTES: Record<
  AutomaticCancellationReason,
  string
> = {
  "no-show": "Canceled due to no show",
  decline: "Canceled due to decline",
};

export async function logAutomaticCancellationTransition(
  context: AutomaticCancellationContext,
): Promise<void> {
  if (!context.automationReason) {
    return;
  }

  if (!context.calendarEventId) {
    console.warn(
      `⚠️ XSTATE AUTOMATIC CANCEL LOG SKIPPED - MISSING CALENDAR EVENT ID [${context.tenant?.toUpperCase() || "UNKNOWN"}]:`,
      {
        automationReason: context.automationReason,
      },
    );
    return;
  }

  try {
    const { logServerBookingChange, serverGetDataByCalendarEventId } =
      await import("@/lib/firebase/server/adminDb");
    const { TableNames } = await import("@/components/src/policy");
    const { BookingStatusLabel } = await import("@/components/src/types");

    const bookingDoc = await serverGetDataByCalendarEventId<AutomaticCancellationBooking>(
      TableNames.BOOKING,
      context.calendarEventId,
      context.tenant,
    );

    if (!bookingDoc) {
      console.error(
        `❌ XSTATE AUTOMATIC CANCEL LOG: Booking not found [${context.tenant?.toUpperCase() || "UNKNOWN"}]`,
        { calendarEventId: context.calendarEventId },
      );
      return;
    }

    const automationReason =
      context.automationReason as AutomaticCancellationReason;
    const note =
      AUTOMATIC_CANCELLATION_NOTES[automationReason] ||
      "Automatic cancellation";

    await logServerBookingChange({
      bookingId: bookingDoc.id,
      calendarEventId: context.calendarEventId,
      status: BookingStatusLabel.CANCELED,
      changedBy: "System",
      requestNumber: bookingDoc.requestNumber || 0,
      note,
      tenant: context.tenant,
    });

    console.log(
      `📋 XSTATE AUTOMATIC CANCEL LOGGED [${context.tenant?.toUpperCase() || "UNKNOWN"}]:`,
      {
        calendarEventId: context.calendarEventId,
        automationReason,
        note,
        changedBy: "System",
      },
    );
  } catch (error) {
    console.error(
      `🚨 XSTATE AUTOMATIC CANCEL LOG FAILED [${context.tenant?.toUpperCase() || "UNKNOWN"}]:`,
      {
        calendarEventId: context.calendarEventId,
        automationReason: context.automationReason,
        error: error.message,
      },
    );
  }
}