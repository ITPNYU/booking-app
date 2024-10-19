import React, { useEffect, useRef } from "react";

import { STORAGE_KEY_BOOKING } from "../../mediaCommonsPolicy";
//@ts-ignore
import useWebSocket from "react-use-websocket";

export default function useFakeDataLocalStorage(
  setBookings,
  setBookingStatuses
) {
  const { lastMessage } = useWebSocket(
    "ws://localhost:3001",
    { shouldReconnect: (closeEvent) => false },
    process.env.BRANCH_NAME === "development"
  );
  const hasUpdated = useRef(false);

  useEffect(() => {
    if (lastMessage == null) {
      return;
    }

    if (lastMessage.data.startsWith("ADD:")) {
      const fakeBookings = localStorage.getItem(STORAGE_KEY_BOOKING);
      const data = lastMessage.data.substring("ADD:".length);
      if (fakeBookings == null) {
        initialize(data);
      } else {
        update(data);
      }
    }
    console.log("FROM SERVER:", lastMessage);
  }, [lastMessage]);

  useEffect(() => {
    const existingFakeData = localStorage.getItem(STORAGE_KEY_BOOKING);
    if (
      existingFakeData != null &&
      hasUpdated.current === false &&
      process.env.BRANCH_NAME === "development"
    ) {
      const json = JSON.parse(existingFakeData);

      setBookings((prev) => {
        const existingIds = prev.map((row) => row.calendarEventId);
        const toAdd = json.bookingRows.filter(
          (row) => !existingIds.includes(row.calendarEventId)
        );
        return [...prev, ...toAdd];
      });

      setBookingStatuses((prev) => {
        const existingIds = prev.map((row) => row.calendarEventId);
        const toAdd = json.bookingStatusRows.filter(
          (row) => !existingIds.includes(row.calendarEventId)
        );
        return [...prev, ...toAdd];
      });
      hasUpdated.current = true;
    }
  }, []);

  const initialize = (data: string) => {
    localStorage.setItem(STORAGE_KEY_BOOKING, data);
    const json = JSON.parse(data);
    if (process.env.BRANCH_NAME === "development") {
      setBookings((prev) => [...prev, ...json.bookingRows]);
      setBookingStatuses((prev) => [...prev, ...json.bookingStatusRows]);
    }
  };

  const update = (data: string) => {
    const existingFakeData = JSON.parse(
      localStorage.getItem(STORAGE_KEY_BOOKING)
    );
    const json = JSON.parse(data);
    existingFakeData.bookingRows = existingFakeData.bookingRows.concat(
      json.bookingRows
    );
    existingFakeData.bookingStatusRows =
      existingFakeData.bookingStatusRows.concat(json.bookingStatusRows);
    localStorage.setItem(STORAGE_KEY_BOOKING, JSON.stringify(existingFakeData));

    if (process.env.BRANCH_NAME === "development") {
      setBookings((prev) => [...prev, ...json.bookingRows]);
      setBookingStatuses((prev) => [...prev, ...json.bookingStatusRows]);
    }
  };
}
