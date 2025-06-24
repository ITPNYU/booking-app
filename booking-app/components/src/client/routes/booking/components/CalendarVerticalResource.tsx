import {
  CalendarApi,
  DateSelectArg,
  EventClickArg,
  EventDropArg,
} from "@fullcalendar/core";
import { Box, Typography, useMediaQuery, useTheme } from "@mui/material";
import { useContext, useEffect, useMemo, useRef } from "react";
import { Days, FormContextLevel, RoomSetting } from "../../../../types";
import CalendarEventBlock, { NEW_TITLE_TAG } from "./CalendarEventBlock";

import googleCalendarPlugin from "@fullcalendar/google-calendar";
import interactionPlugin from "@fullcalendar/interaction"; // for selectable
import FullCalendar from "@fullcalendar/react";
import resourceTimeGridPlugin from "@fullcalendar/resource-timegrid";
import { Error } from "@mui/icons-material";
import { styled } from "@mui/system";
import dayjs from "dayjs";
import { EventResizeDoneArg } from "fullcalendar";
import { DatabaseContext } from "../../components/Provider";
import { BookingContext } from "../bookingProvider";
import { useBookingDateRestrictions } from "../hooks/useBookingDateRestrictions";

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

  ".fc": {
    fontFamily: "Roboto, Arial, sans-serif",
  },
  ".disabled": {
    background: "#e0e0e0",
    pointerEvents: "none",
  },
  ".blackout-period": {
    background: "#e0e0e0 !important",
    borderColor: "#bdbdbd !important",
    color: "#000000 !important",
    pointerEvents: "none",
    opacity: 0.8,
  },
  ".blackout-period .fc-event-title": {
    fontWeight: "bold",
    fontSize: "0.8em",
  },
});

const Empty = styled(Box)(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
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
  const { operationHours, pagePermission } = useContext(DatabaseContext);
  const { getBlackoutPeriodsForDateAndRooms } = useBookingDateRestrictions();
  const {
    bookingCalendarInfo,
    existingCalendarEvents,
    setBookingCalendarInfo,
    fetchingStatus,
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

  // Generate blackout blocks for rooms that are in blackout periods on the selected date
  const blackoutBlocks = useMemo(() => {
    const selectedDate = dayjs(dateView);
    const blocks: any[] = [];

    rooms.forEach((room) => {
      const blackoutPeriods = getBlackoutPeriodsForDateAndRooms(selectedDate, [
        room.roomId,
      ]);

      blackoutPeriods.forEach((period) => {
        // Create full day blackout block for this room
        const startOfDay = selectedDate.startOf("day");
        const endOfDay = selectedDate.endOf("day");

        blocks.push({
          start: startOfDay.toISOString(),
          end: endOfDay.toISOString(),
          id: `blackout-${room.roomId}-${period.id}`,
          resourceId: room.roomId + "",
          title: `🚫 ${period.name}`,
          overlap: false,
          display: "background",
          classNames: ["blackout-period"],
          backgroundColor: "#e0e0e0",
          borderColor: "#bdbdbd",
          textColor: "#000000",
        });
      });
    });

    return blocks;
  }, [rooms, dateView, getBlackoutPeriodsForDateAndRooms]);

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
      startEditable: formContext !== FormContextLevel.MODIFICATION,
      groupId: "new",
      url: `${index}:${rooms.length}`, // some hackiness to let us render multiple events visually as one big block
    }));
  }, [bookingCalendarInfo, rooms]);

  const blockPastTimes = useMemo(() => {
    // Only apply past time blocks if not in MODIFICATION mode
    // This allows admins to edit end times of bookings with past start times
    if (formContext === FormContextLevel.MODIFICATION) {
      return [];
    }

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
  }, [rooms, formContext]);

  const handleEventSelect = (selectInfo: DateSelectArg) => {
    setBookingCalendarInfo(selectInfo);
  };

  const handleEventSelecting = (selectInfo: DateSelectArg) => {
    if (ref.current == null || ref.current.getApi() == null) {
      return true;
    }

    // Check if the selection overlaps with any blackout periods
    const selectedDate = dayjs(selectInfo.start);
    const selectedResourceId = selectInfo.resource?.id;

    if (selectedResourceId) {
      const roomId = parseInt(selectedResourceId);
      const blackoutPeriods = getBlackoutPeriodsForDateAndRooms(selectedDate, [
        roomId,
      ]);

      if (blackoutPeriods.length > 0) {
        // Don't allow selection in blackout periods
        return false;
      }
    }

    const api: CalendarApi = ref.current.getApi();
    api.unselect();
    setBookingCalendarInfo(selectInfo);
    return true;
  };

  const handleSelectOverlap = (el) => {
    // Don't allow overlap with blackout periods
    if (el.classNames && el.classNames.includes("blackout-period")) {
      return false;
    }
    return el.overlap;
  };

  useEffect(() => {
    console.log(fetchingStatus);
  }, [fetchingStatus]);

  // clicking on created event should delete it
  // only if not in MODIFICATION mode
  const handleEventClick = (info: EventClickArg) => {
    if (
      info.event.title.includes(NEW_TITLE_TAG) &&
      formContext !== FormContextLevel.MODIFICATION
    ) {
      setBookingCalendarInfo(null);
    }
  };

  // if change event duration via dragging edges or drag event block to move
  const handleEventEdit = (info: EventResizeDoneArg | EventDropArg) => {
    // Always allow modification of end time, even for past events
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

  if (fetchingStatus === "error" && existingCalendarEvents.length === 0) {
    return (
      <Empty>
        <Error />
        <Typography align="center">
          Sorry, we were unable to retrieve existing calendar events.
          <br />
          Please refresh the page if this message appears for more than a few
          seconds.
        </Typography>
      </Empty>
    );
  }

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

  const operationHoursToday = operationHours.find(
    (setting) => Object.values(Days)[dateView.getDay()] === setting.day
  );

  if (fetchingStatus === "loading") {
    return (
      <Empty>
        <Typography>Loading...</Typography>
      </Empty>
    );
  }

  // if (operationHoursToday.isClosed) {
  //   return (
  //     <Empty>
  //       <Typography>The Media Commons are closed on Sundays.</Typography>
  //     </Empty>
  //   );
  // }

  // const slotMinTime = `${operationHoursToday.open}:00:00`;
  // const slotMaxTime = `${operationHoursToday.close}:00:00`;
  // don't use these values until we talk to Samantha/Jhanele

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
        selectable={formContext !== FormContextLevel.MODIFICATION}
        select={handleEventSelect}
        selectAllow={handleEventSelecting}
        selectOverlap={handleSelectOverlap}
        schedulerLicenseKey="CC-Attribution-NonCommercial-NoDerivatives"
        resources={resources}
        resourceOrder={"index"}
        events={[
          ...blackoutBlocks,
          ...blockPastTimes,
          ...existingCalEventsFiltered,
          ...newEvents,
        ]}
        eventContent={(calendarEventInfo) =>
          CalendarEventBlock(calendarEventInfo, pagePermission)
        }
        eventClick={function (info) {
          info.jsEvent.preventDefault();
          handleEventClick(info);
        }}
        eventResize={handleEventEdit}
        eventDrop={handleEventEdit}
        // Enable editing based on form context
        editable={true}
        // Control specific edit behavior
        eventStartEditable={formContext !== FormContextLevel.MODIFICATION}
        eventDurationEditable={true}
        headerToolbar={false}
        slotMinTime="9:00:00"
        allDaySlot={false}
        aspectRatio={isMobile ? 0.5 : 1.5}
        expandRows={true}
        stickyHeaderDates={true}
        ref={ref}
      />
    </FullCalendarWrapper>
  );
}
