import { deleteEvent } from "@/components/src/server/calendars";
import { processCancelBooking } from "@/components/src/server/db";
import {
  serverGetDataByCalendarEventId,
  serverGetDocumentById,
} from "@/lib/firebase/server/adminDb";
import { TableNames } from "@/components/src/policy";
import { DEFAULT_TENANT } from "@/components/src/constants/tenants";
import { applyEnvironmentCalendarIds } from "@/lib/utils/calendarEnvironment";
import { NextRequest } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { calendarEventId, email, netId, tenant } = await req.json();
    // Prefer explicit tenant from body, but allow callers that only set the header.
    // Without a tenant, the booking lookup can hit the wrong collection and
    // silently skip calendar deletion, leaving the room blocked in availability.
    const effectiveTenant =
      tenant || req.headers.get("x-tenant") || DEFAULT_TENANT;

    console.log(
      `🔄 CANCEL PROCESSING API CALLED [${effectiveTenant?.toUpperCase() || "UNKNOWN"}]:`,
      {
        calendarEventId,
        email,
        netId,
        tenant: effectiveTenant,
        tenantSource: tenant
          ? "body"
          : req.headers.get("x-tenant")
            ? "header"
            : "default",
      },
    );

    // Call the shared cancel processing function
    await processCancelBooking(calendarEventId, email, netId, effectiveTenant);

    // Delete calendar events from Google Calendar for CANCELED bookings
    // This ensures true availability is reflected in the Google Calendar UI
    try {
      // Get booking information to find room calendar IDs
      const booking = (await serverGetDataByCalendarEventId(
        TableNames.BOOKING,
        calendarEventId,
        effectiveTenant,
      )) as any;
      if (!booking) {
        console.error(
          "Booking not found for calendarEventId:",
          calendarEventId,
        );
      } else {
        // Get tenant schema to find room calendar IDs
        const schema = await serverGetDocumentById(
          TableNames.TENANT_SCHEMA,
          effectiveTenant || DEFAULT_TENANT,
        );

        if (schema && schema.resources && booking.roomId) {
          // Apply environment-based calendar ID selection
          const resourcesWithCorrectCalendarIds = applyEnvironmentCalendarIds(
            schema.resources,
          );

          const roomIds = booking.roomId.split(",").map(x => x.trim());
          const rooms = resourcesWithCorrectCalendarIds.filter(
            (resource: any) => roomIds.includes(`${resource.roomId}`),
          );

          console.log(
            `🗑️ DELETING CANCELED CALENDAR EVENTS [${effectiveTenant?.toUpperCase() || "UNKNOWN"}]:`,
            {
              calendarEventId,
              roomIds,
              rooms: rooms.map((r: any) => ({
                roomId: r.roomId,
                calendarId: r.calendarId,
              })),
            },
          );

          // Delete calendar event from each room's calendar
          await Promise.all(
            rooms.map(async (room: any) => {
              if (room.calendarId) {
                console.log(
                  `🗑️ Deleting event ${calendarEventId} from calendar ${room.calendarId} (room ${room.roomId})`,
                );
                await deleteEvent(
                  room.calendarId,
                  calendarEventId,
                  room.roomId,
                );
              }
            }),
          );

          console.log(
            `✅ CANCELED CALENDAR EVENTS DELETED [${effectiveTenant?.toUpperCase() || "UNKNOWN"}]:`,
            {
              calendarEventId,
              deletedFromCalendars: rooms.length,
            },
          );
        } else {
          console.warn(
            `⚠️ NO ROOM SCHEMA FOUND FOR CALENDAR DELETION [${effectiveTenant?.toUpperCase() || "UNKNOWN"}]:`,
            {
              calendarEventId,
              hasSchema: !!schema,
              hasResources: !!(schema && schema.resources),
              roomId: booking.roomId,
            },
          );
        }
      }
    } catch (error) {
      console.error(
        `🚨 CANCEL CALENDAR DELETION FAILED [${effectiveTenant?.toUpperCase() || "UNKNOWN"}]:`,
        {
          calendarEventId,
          error: error.message,
        },
      );
      // Don't throw error - calendar deletion failure shouldn't prevent booking cancellation
    }

    console.log(
      `✅ CANCEL PROCESSING API SUCCESS [${effectiveTenant?.toUpperCase() || "UNKNOWN"}]:`,
      {
        calendarEventId,
        email,
        netId,
      },
    );

    return Response.json({ success: true });
  } catch (error) {
    console.error("🚨 CANCEL PROCESSING API ERROR:", {
      error: error.message,
      stack: error.stack,
    });

    return Response.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
