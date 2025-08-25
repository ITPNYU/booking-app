import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { DEFAULT_TENANT } from "../../../../constants/tenants";
import { CalendarEvent, RoomSetting } from "../../../../types";

import { CALENDAR_HIDE_STATUS } from "../../../../policy";

export default function fetchCalendarEvents(allRooms: RoomSetting[]) {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [fetchingStatus, setFetchingStatus] = useState<
    "loading" | "loaded" | "error" | null
  >(null);
  const { tenant } = useParams();

  const loadEvents = useCallback(() => {
    if (allRooms.length === 0) {
      return;
    }
    Promise.all(allRooms.map(fetchRoomCalendarEvents)).then((results) => {
      const flatResults = results.flat();
      console.log("FETCHED CALENDAR RESULTS:", flatResults.length);
      const filtered = flatResults.filter(
        (event) =>
          !CALENDAR_HIDE_STATUS.some((hideStatus) =>
            event.title?.includes(hideStatus)
          )
      );
      if (filtered.length === 0 && events.length > 0) {
        console.log("!!! RE-FETCHING CALENDAR EVENTS WAS EMPTY !!!");
      } else {
        setEvents(filtered);
      }
    });
  }, [allRooms, events]);

  useEffect(() => {
    loadEvents();
  }, [allRooms]);

  const fetchRoomCalendarEvents = async (room: RoomSetting) => {
    const calendarId = room.calendarId;
    setFetchingStatus("loading");
    let response = null;
    try {
      console.log(
        `Fetching calendar events for room ${room.roomId} (${calendarId}) with tenant: ${tenant}`
      );
      response = await fetch(
        `${process.env.NEXT_PUBLIC_BASE_URL}/api/calendarEvents?calendarId=${calendarId}`,
        {
          headers: {
            "Content-Type": "application/json",
            "x-tenant": (tenant as string) || DEFAULT_TENANT,
          },
        }
      );
    } catch (e) {
      console.error("Error fetching calendar events", e);
      setFetchingStatus("error");
    }

    const data = await response.json();
    console.log(
      `Received ${data.length} events for room ${room.roomId} (tenant: ${tenant}):`,
      data.map((event) => ({
        title: event.title,
        calendarEventId: event.calendarEventId,
        booking: event.booking,
      }))
    );

    const filteredEvents = data.filter((row: any) => {
      return !CALENDAR_HIDE_STATUS.some((status) =>
        row?.title?.includes(status)
      );
    });
    const rowsWithResourceIds = filteredEvents.map((row) => {
      // Add visual indication for different booking statuses
      let backgroundColor = "#3174ad"; // Default blue for approved/confirmed
      let textColor = "white";

      if (row.booking) {
        const status = row.booking.status;
        console.log(
          `Event ${row.calendarEventId} has booking status: ${status}`
        );

        switch (status) {
          case "REQUESTED":
            backgroundColor = "#ff9800"; // Orange for requested
            break;
          case "PENDING":
            backgroundColor = "#ffc107"; // Yellow for pending
            break;
          case "APPROVED":
            backgroundColor = "#4caf50"; // Green for approved
            break;
          case "DECLINED":
            backgroundColor = "#f44336"; // Red for declined
            break;
          case "CANCELED":
            backgroundColor = "#9e9e9e"; // Gray for canceled
            break;
        }
      }

      return {
        ...row,
        id: `${row.calendarEventId}:${room.roomId}:${row.start}`,
        resourceId: room.roomId + "",
        overlap: false, // Prevent overlapping with this event
        backgroundColor,
        textColor,
        constraint: "businessHours", // Optional: add constraint
      };
    });
    setFetchingStatus("loaded");
    return rowsWithResourceIds;
  };

  return {
    existingCalendarEvents: events,
    reloadExistingCalendarEvents: loadEvents,
    fetchingStatus: fetchingStatus,
  };
}
