import { CalendarEvent, Resource } from "../../../../types";
import { useCallback, useEffect, useState } from "react";

import { CALENDAR_HIDE_STATUS } from "../../../../policy";

export default function fetchCalendarEvents(allResources: Resource[]) {
  const [events, setEvents] = useState<CalendarEvent[]>([]);

  const loadEvents = useCallback(() => {
    if (allResources.length === 0) {
      return;
    }
    Promise.all(allResources.map(fetchRoomCalendarEvents)).then((results) => {
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
  }, [allResources, events]);

  useEffect(() => {
    loadEvents();
  }, [allResources]);

  const fetchRoomCalendarEvents = async (room: Resource) => {
    const calendarId = room.calendarId;
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_BASE_URL}/api/calendarEvents?calendarId=${calendarId}`,
      {
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
    const data = await response.json();

    const filteredEvents = data.filter((row: any) => {
      return !CALENDAR_HIDE_STATUS.some((status) =>
        row?.title?.includes(status)
      );
    });
    const rowsWithResourceIds = filteredEvents.map((row) => ({
      ...row,
      id: `${row.calendarEventId}:${room.roomId}:${row.start}`,
      resourceId: room.roomId + "",
    }));
    return rowsWithResourceIds;
  };

  return {
    existingCalendarEvents: events,
    reloadExistingCalendarEvents: loadEvents,
  };
}
