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

  const fetchRoomCalendarEvents = useCallback(async (room: RoomSetting): Promise<CalendarEvent[]> => {
    const calendarId = room.calendarId;
    let response = null;
    try {
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
      console.error(`Error fetching calendar events for room ${room.roomId}:`, e);
      return []; // Return empty array instead of undefined
    }

    if (!response || !response.ok) {
      console.error(`Failed to fetch calendar events for room ${room.roomId}:`, response?.status);
      return []; // Return empty array instead of undefined
    }

    const data = await response.json();
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
    return rowsWithResourceIds;
  }, [tenant]);

  const loadEvents = useCallback(() => {
    if (allRooms.length === 0) {
      setEvents([]);
      return;
    }
    
    setFetchingStatus("loading");
    
    Promise.all(allRooms.map(fetchRoomCalendarEvents))
      .then((results) => {
        const flatResults = results.flat().filter((event): event is CalendarEvent => event !== undefined);
        console.log("FETCHED CALENDAR RESULTS:", flatResults.length);
        
        // Always update events, even if empty, to prevent stale data
        setEvents(flatResults);
        setFetchingStatus("loaded");
      })
      .catch((error) => {
        console.error("Error loading calendar events:", error);
        setFetchingStatus("error");
        // Don't clear events on error - keep existing ones to avoid flickering
      });
  }, [allRooms, fetchRoomCalendarEvents]);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  return {
    existingCalendarEvents: events,
    reloadExistingCalendarEvents: loadEvents,
    fetchingStatus: fetchingStatus,
  };
}
