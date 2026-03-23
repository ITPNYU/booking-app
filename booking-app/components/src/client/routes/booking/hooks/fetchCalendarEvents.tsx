import { useParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { DEFAULT_TENANT } from "../../../../constants/tenants";
import { CalendarEvent, RoomSetting } from "../../../../types";

import { CALENDAR_HIDE_STATUS } from "../../../../policy";

export default function fetchCalendarEvents(allRooms: RoomSetting[]) {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [fetchingStatus, setFetchingStatus] = useState<
    "loading" | "loaded" | "error" | null
  >(null);
  const { tenant } = useParams();

  // Track in-flight request to prevent duplicate fetches
  const inflightRef = useRef<AbortController | null>(null);

  const mapEventsForRoom = useCallback(
    (room: RoomSetting, data: any[]): CalendarEvent[] => {
      const filteredEvents = data.filter(
        (row: any) =>
          !CALENDAR_HIDE_STATUS.some((status) => row?.title?.includes(status)),
      );
      return filteredEvents.map((row) => {
        let backgroundColor = "#3174ad";
        const textColor = "white";

        if (row.booking) {
          const { status } = row.booking;
          switch (status) {
            case "REQUESTED":
              backgroundColor = "#ff9800";
              break;
            case "PENDING":
              backgroundColor = "#ffc107";
              break;
            case "APPROVED":
              backgroundColor = "#4caf50";
              break;
            case "DECLINED":
              backgroundColor = "#f44336";
              break;
            case "CANCELED":
              backgroundColor = "#9e9e9e";
              break;
          }
        }

        return {
          ...row,
          id: `${row.calendarEventId}:${room.roomId}:${row.start}`,
          resourceId: `${room.roomId}`,
          overlap: false,
          backgroundColor,
          textColor,
          constraint: "businessHours",
        };
      });
    },
    [],
  );

  const loadEvents = useCallback(() => {
    if (inflightRef.current) {
      inflightRef.current.abort();
      inflightRef.current = null;
    }

    if (allRooms.length === 0) {
      setEvents([]);
      return;
    }
    const controller = new AbortController();
    inflightRef.current = controller;

    setFetchingStatus("loading");

    const calendarIds = allRooms.map((room) => room.calendarId).join(",");
    const query = new URLSearchParams({
      calendarIds,
    }).toString();

    fetch(
      `/api/calendarEvents?${query}`,
      {
        headers: {
          "Content-Type": "application/json",
          "x-tenant": (tenant as string) || DEFAULT_TENANT,
        },
        signal: controller.signal,
      },
    )
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Failed to fetch calendar events: ${response.status}`);
        }
        return response.json();
      })
      .then((grouped: Record<string, any[]>) => {
        const allEvents: CalendarEvent[] = [];
        for (const room of allRooms) {
          const roomEvents = grouped[room.calendarId] || [];
          allEvents.push(...mapEventsForRoom(room, roomEvents));
        }

        const filtered = allEvents.filter(
          (event) =>
            event &&
            event.title &&
            !CALENDAR_HIDE_STATUS.some((hideStatus) =>
              event.title.includes(hideStatus),
            ),
        );

        setEvents(filtered);
        setFetchingStatus("loaded");
      })
      .catch((error) => {
        if (error?.name === "AbortError") return;
        console.error("Error loading calendar events:", error);
        setFetchingStatus("error");
      });
  }, [allRooms, tenant, mapEventsForRoom]);

  useEffect(() => {
    loadEvents();
    // Cleanup: abort on unmount
    return () => {
      if (inflightRef.current) {
        inflightRef.current.abort();
      }
    };
  }, [loadEvents]);

  return {
    existingCalendarEvents: events,
    reloadExistingCalendarEvents: loadEvents,
    fetchingStatus,
  };
}
