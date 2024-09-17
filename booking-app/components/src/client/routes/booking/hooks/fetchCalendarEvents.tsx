import { Booking, CalendarEvent, RoomSetting } from "../../../../types";
import { CALENDAR_HIDE_STATUS, STORAGE_KEY_BOOKING } from "../../../../policy";
import { useCallback, useEffect, useMemo, useState } from "react";

import axios from "axios";
import getBookingStatus from "../../hooks/getBookingStatus";

export default function fetchCalendarEvents(allRooms: RoomSetting[]) {
  const [events, setEvents] = useState<CalendarEvent[]>([]);

  const loadEvents = useCallback(() => {
    Promise.all(allRooms.map(fetchRoomCalendarEvents)).then(
      (results) => {
        const flatResults = results.flat();
        console.log(
          "FETCHED CALENDAR RESULTS FOR EACH ROOM (flat)",
          flatResults
        );
        const filtered = flatResults.filter(
          (event) =>
            !CALENDAR_HIDE_STATUS.some((hideStatus) =>
              event.title?.includes(hideStatus)
            )
        );
        console.log("FILTERED", filtered);
        setEvents(filtered);
      }
      // setEvents(
      //   [...results.flat()].filter(
      //     (event) =>
      //       !CALENDAR_HIDE_STATUS.some((status) =>
      //         event?.title?.includes(status)
      //       )
      //   )
      // )
    );
  }, [allRooms]);

  useEffect(() => {
    loadEvents();
  }, [allRooms]);

  const fetchRoomCalendarEvents = async (room: RoomSetting) => {
    const calendarId = room.calendarId;
    const response = await axios.get(
      `${process.env.NEXT_PUBLIC_BASE_URL}/api/calendarEvents`,
      {
        params: { calendarId: calendarId },
      }
    );
    const filteredEvents = response.data.filter((row: any) => {
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

  // TODO add this back or delete it
  // const getFakeEvents: () => CalendarEvent[] = () => {
  //   const existingFakeData = localStorage.getItem(STORAGE_KEY_BOOKING);
  //   if (existingFakeData != null && process.env.BRANCH_NAME === "development") {
  //     const json = JSON.parse(existingFakeData);
  //     return json.bookingRows.map((booking: Booking) => ({
  //       title: `[${getBookingStatus(booking, json.bookingStatusRows)}] ${
  //         booking.title
  //       }`,
  //       start: booking.startDate,
  //       end: booking.endDate,
  //       id: booking.roomId,
  //       resourceId: booking.roomId,
  //     }));
  //   }
  //   return [];
  // };

  return {
    existingCalendarEvents: events,
    reloadExistingCalendarEvents: loadEvents,
  };
}
