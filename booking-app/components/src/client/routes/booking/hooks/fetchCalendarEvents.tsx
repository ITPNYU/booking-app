import { CalendarEvent, RoomSetting } from "../../../../types";
import { useCallback, useEffect, useState } from "react";

import { CALENDAR_HIDE_STATUS } from "../../../../policy";

export default function fetchCalendarEvents(allRooms: RoomSetting[]) {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [fetchingStatus, setFetchingStatus] = useState<"loading" | "loaded" | "error" | null>(null);

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
      response = await fetch(
        `${process.env.NEXT_PUBLIC_BASE_URL}/api/calendarEvents?calendarId=${calendarId}`,
        {
          headers: {
            "Content-Type": "application/json",
          },
        }
      );
    } catch (e) {
      console.error("Error fetching calendar events", e);
      setFetchingStatus("error");
    }

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
    setFetchingStatus("loaded");
    return rowsWithResourceIds;
  };

  return {
    existingCalendarEvents: events,
    reloadExistingCalendarEvents: loadEvents,
    fetchingStatus: fetchingStatus,
  };
}
