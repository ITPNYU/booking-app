import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DEFAULT_TENANT } from "../../../../constants/tenants";
import { CalendarEvent, RoomSetting } from "../../../../types";

import { CALENDAR_HIDE_STATUS } from "../../../../policy";

// The calendar is a single-day resource view driven by `viewDate`. Rather than
// pre-loading a fixed 12-month window (expensive, and it saturated the server),
// fetch only a window around the viewed month (± ~1 week so week views that
// straddle a month boundary are covered). Day/week navigation within the month
// needs no refetch; moving to another month refetches that window.
function monthWindow(viewDate: Date) {
  const y = viewDate.getFullYear();
  const m = viewDate.getMonth();
  const start = new Date(y, m, 1);
  start.setDate(start.getDate() - 7);
  const end = new Date(y, m + 1, 0, 23, 59, 59);
  end.setDate(end.getDate() + 7);
  return { start: start.toISOString(), end: end.toISOString() };
}

export default function fetchCalendarEvents(
  allRooms: RoomSetting[],
  viewDate: Date = new Date(),
) {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [fetchingStatus, setFetchingStatus] = useState<
    "loading" | "loaded" | "error" | null
  >(null);
  const { tenant } = useParams();

  // Track in-flight request to prevent duplicate fetches
  const inflightRef = useRef<AbortController | null>(null);

  // The fetched window only depends on the viewed month, not the exact day, so
  // navigating day-to-day within a month does not change these and does not
  // trigger a refetch.
  const windowKey = `${viewDate.getFullYear()}-${viewDate.getMonth()}`;
  const { start: windowStart, end: windowEnd } = useMemo(
    () => monthWindow(viewDate),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [windowKey],
  );

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

  const loadEvents = useCallback(
    (opts: { fresh?: boolean } = {}) => {
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
      const params: Record<string, string> = {
        calendarIds,
        start: windowStart,
        end: windowEnd,
      };
      // After a booking is created/changed, refetch bypassing the server cache
      // so the new calendar event is reflected immediately.
      if (opts.fresh) params.fresh = "1";
      const query = new URLSearchParams(params).toString();

      fetch(`/api/calendarEvents?${query}`, {
        headers: {
          "Content-Type": "application/json",
          "x-tenant": (tenant as string) || DEFAULT_TENANT,
        },
        signal: controller.signal,
      })
        .then((response) => {
          if (!response.ok) {
            throw new Error(
              `Failed to fetch calendar events: ${response.status}`,
            );
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
    },
    [allRooms, tenant, mapEventsForRoom, windowStart, windowEnd],
  );

  useEffect(() => {
    loadEvents();
    // Cleanup: abort on unmount
    return () => {
      if (inflightRef.current) {
        inflightRef.current.abort();
      }
    };
  }, [loadEvents]);

  const reload = useCallback(() => loadEvents({ fresh: true }), [loadEvents]);

  return {
    existingCalendarEvents: events,
    reloadExistingCalendarEvents: reload,
    fetchingStatus,
  };
}
