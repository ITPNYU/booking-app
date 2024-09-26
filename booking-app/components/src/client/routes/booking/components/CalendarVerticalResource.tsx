import { Box, Typography, useMediaQuery, useTheme } from "@mui/material";
import {
  CalendarApi,
  DateSelectArg,
  EventClickArg,
  EventDropArg,
} from "@fullcalendar/core";
import CalendarEventBlock, { NEW_TITLE_TAG } from "./CalendarEventBlock";
import { FormContextLevel, RoomSetting } from "../../../../types";
import React, { useContext, useEffect, useMemo, useRef } from "react";

import { BookingContext } from "../bookingProvider";
import { EventResizeDoneArg } from "fullcalendar";
import FullCalendar from "@fullcalendar/react";
import googleCalendarPlugin from "@fullcalendar/google-calendar";
import interactionPlugin from "@fullcalendar/interaction"; // for selectable
import resourceTimeGridPlugin from "@fullcalendar/resource-timegrid";
import { styled } from "@mui/system";

interface Props {
  calendarEventId?: string;
  formContext: FormContextLevel;
  rooms: RoomSetting[];
  dateView: Date;
}

const FullCalendarWrapper = styled(Box)({
  marginTop: 12,
  ".fc-day-today": {
    background: "white !important",
  },

  ".fc-col-header-cell-cushion": {
    fontSize: "small",
    lineHeight: "normal",
  },

  ".fc-timegrid-col-events": {
    margin: 0,
  },

  ".fc-v-event": {
    border: "none",
    textDecoration: "none",
    backgroundColor: "unset",
    boxShadow: "unset",
  },
  "a:hover": {
    border: "none",
    textDecoration: "none !important",
  },

  ".fc-event:focus::after": {
    background: "none",
  },

  ".fc-timegrid-event-harness": {
    left: "0% !important",
  },

  ".fc-bg-event": {
    background: "none",
  },

  ".disabled div": {
    background: "#55555569",
    border: "none",
  },
});

const Empty = styled(Box)(({ theme }) => ({
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  height: 500,
  color: theme.palette.custom.gray3,
}));

export default function CalendarVerticalResource({
  calendarEventId,
  formContext,
  rooms,
  dateView,
}: Props) {
  const {
    bookingCalendarInfo,
    existingCalendarEvents,
    setBookingCalendarInfo,
  } = useContext(BookingContext);
  const ref = useRef(null);

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  const resources = useMemo(
    () =>
      rooms.map((room) => ({
        id: room.roomId + "",
        title: `${room.roomId} ${room.name}`,
        index: Number(room.roomId),
      })),
    [rooms]
  );

  // update calendar day view based on mini calendar date picker
  useEffect(() => {
    if (ref.current == null || ref.current.getApi() == null) {
      return;
    }
    const api: CalendarApi = ref.current.getApi();
    api.gotoDate(dateView);
  }, [dateView]);

  const newEvents = useMemo(() => {
    if (bookingCalendarInfo == null) {
      return [];
    }

    return rooms.map((room, index) => ({
      start: bookingCalendarInfo.startStr,
      end: bookingCalendarInfo.endStr,
      id: room.roomId + bookingCalendarInfo.startStr,
      resourceId: room.roomId + "",
      title: NEW_TITLE_TAG,
      overlap: true,
      durationEditable: true,
      startEditable: true,
      groupId: "new",
      url: `${index}:${rooms.length}`, // some hackiness to let us render multiple events visually as one big block
    }));
  }, [bookingCalendarInfo, rooms]);

  const blockPastTimes = useMemo(() => {
    const blocks = rooms.map((room) => {
      const today = new Date();
      const start = new Date();
      start.setHours(9);
      start.setMinutes(0);
      today.setHours(
        today.getMinutes() > 30 ? today.getHours() + 1 : today.getHours()
      );
      today.setMinutes(today.getMinutes() <= 30 ? 30 : 0);
      today.setSeconds(0);
      today.setMilliseconds(0);
      return {
        start: start.toISOString(),
        end: today.toISOString(),
        id: room.roomId + "bg",
        resourceId: room.roomId + "",
        overlap: false,
        display: "background",
        classNames: ["disabled"],
      };
    });
    return blocks;
  }, [rooms]);

  const handleEventSelect = (selectInfo: DateSelectArg) => {
    setBookingCalendarInfo(selectInfo);
  };

  const handleEventSelecting = (selectInfo: DateSelectArg) => {
    if (ref.current == null || ref.current.getApi() == null) {
      return true;
    }
    const api: CalendarApi = ref.current.getApi();
    api.unselect();
    setBookingCalendarInfo(selectInfo);
    return true;
  };

  const handleSelectOverlap = (el) => {
    return el.overlap;
  };

  // clicking on created event should delete it
  const handleEventClick = (info: EventClickArg) => {
    if (info.event.title.includes(NEW_TITLE_TAG)) {
      setBookingCalendarInfo(null);
    }
  };

  // if change event duration via dragging edges or drag event block to move
  const handleEventEdit = (info: EventResizeDoneArg | EventDropArg) => {
    setBookingCalendarInfo({
      startStr: info.event.startStr,
      start: info.event.start,
      endStr: info.event.endStr,
      end: info.event.end,
      allDay: false,
      jsEvent: info.jsEvent,
      view: info.view,
    });
  };

  // for editing an existing reservation
  const existingCalEventsFiltered = useMemo(() => {
    if (
      (formContext !== FormContextLevel.EDIT &&
        formContext !== FormContextLevel.MODIFICATION) ||
      calendarEventId == null ||
      calendarEventId.length === 0
    )
      return existingCalendarEvents;

    // based on how we format the id in fetchCalendarEvents
    return existingCalendarEvents.filter(
      (event) => event.id.split(":")[0] !== calendarEventId
    );
  }, [existingCalendarEvents, formContext]);

  if (rooms.length === 0) {
    return (
      <Empty>
        <Typography>
          Select spaces to view their availability, then click and drag to
          choose a time slot
        </Typography>
      </Empty>
    );
  }

  return (
    <FullCalendarWrapper>
      <FullCalendar
        initialDate={dateView}
        initialView="resourceTimeGridDay"
        plugins={[
          resourceTimeGridPlugin,
          googleCalendarPlugin,
          interactionPlugin,
        ]}
        selectable={true}
        select={handleEventSelect}
        selectAllow={handleEventSelecting}
        selectOverlap={handleSelectOverlap}
        schedulerLicenseKey="CC-Attribution-NonCommercial-NoDerivatives"
        resources={resources}
        resourceOrder={"index"}
        events={[...blockPastTimes, ...existingCalEventsFiltered, ...newEvents]}
        eventContent={CalendarEventBlock}
        eventClick={function (info) {
          info.jsEvent.preventDefault();
          handleEventClick(info);
        }}
        eventResize={handleEventEdit}
        eventDrop={handleEventEdit}
        headerToolbar={false}
        slotMinTime="09:00:00"
        slotMaxTime="21:00:00"
        allDaySlot={false}
        aspectRatio={isMobile ? 0.5 : 1.5}
        expandRows={true}
        stickyHeaderDates={true}
        ref={ref}
      />
    </FullCalendarWrapper>
  );
}
