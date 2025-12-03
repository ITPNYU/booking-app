import { hasAnyPermission } from "@/components/src/utils/permissions";
import {
  CalendarApi,
  DateSelectArg,
  EventClickArg,
  EventDropArg,
} from "@fullcalendar/core";
import { Box, Typography, useMediaQuery, useTheme } from "@mui/material";
import { useContext, useEffect, useMemo, useRef } from "react";
import {
  Days,
  FormContextLevel,
  PagePermission,
  RoomSetting,
} from "../../../../types";
import CalendarEventBlock, { NEW_TITLE_TAG } from "./CalendarEventBlock";

import googleCalendarPlugin from "@fullcalendar/google-calendar";
import interactionPlugin from "@fullcalendar/interaction"; // for selectable
import FullCalendar from "@fullcalendar/react";
import resourceTimeGridPlugin from "@fullcalendar/resource-timegrid";
import { Error } from "@mui/icons-material";
import { styled } from "@mui/system";
import dayjs from "dayjs";
import { EventResizeDoneArg } from "fullcalendar";
import { getBlackoutTimeRangeForDate } from "../../../../utils/blackoutUtils";
import { DatabaseContext } from "../../components/Provider";
import { BookingContext } from "../bookingProvider";
import { useBookingDateRestrictions } from "../hooks/useBookingDateRestrictions";
import { TIMEZONE } from "../../../utils/date";

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
  const { getBlackoutPeriodsForDateAndRooms, isBookingTimeInBlackout } =
    useBookingDateRestrictions();
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

  const isAdminPermission = hasAnyPermission(pagePermission, [
    PagePermission.ADMIN,
    PagePermission.SUPER_ADMIN,
    PagePermission.PA,
  ]);

  // Generate blackout blocks for rooms that are in blackout periods on the selected date
  const blackoutBlocks = useMemo(() => {
    const selectedDate = dayjs(dateView);
    const blocks: any[] = [];

    rooms.forEach((room) => {
      const blackoutPeriods = getBlackoutPeriodsForDateAndRooms(selectedDate, [
        room.roomId,
      ]);

      console.log(`Room ${room.roomId} blackout periods:`, blackoutPeriods);

      blackoutPeriods.forEach((period) => {
        const blackoutRange = getBlackoutTimeRangeForDate(period, selectedDate);

        if (blackoutRange) {
          const blockEvent = {
            start: blackoutRange.start.toISOString(),
            end: blackoutRange.end.toISOString(),
            id: `blackout-${room.roomId}-${period.id}`,
            resourceId: room.roomId + "",
            title: blackoutRange.title,
            overlap: false,
            display: "background",
            classNames: ["blackout-period"],
            backgroundColor: "#e0e0e0",
            borderColor: "#bdbdbd",
            textColor: "#000000",
            extendedProps: {
              selectable: false,
            },
          };

          console.log("Adding blackout block:", blockEvent);
          blocks.push(blockEvent);
        }
      });
    });

    console.log("Total blackout blocks generated:", blocks.length);
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
      startEditable:
        formContext !== FormContextLevel.MODIFICATION || isAdminPermission,
      groupId: "new",
      url: `${index}:${rooms.length}`, // some hackiness to let us render multiple events visually as one big block
    }));
  }, [bookingCalendarInfo, rooms, formContext, isAdminPermission]);

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
    // Check if the selection overlaps with any blackout periods before setting booking info
    const bookingStart = dayjs(selectInfo.start);
    const bookingEnd = dayjs(selectInfo.end);
    const selectedResourceId = selectInfo.resource?.id;

    if (selectedResourceId) {
      const roomId = parseInt(selectedResourceId);

      // Use the new time-aware blackout checking
      const { inBlackout } = isBookingTimeInBlackout(bookingStart, bookingEnd, [
        roomId,
      ]);

      if (inBlackout) {
        // Don't allow selection in blackout periods
        if (ref.current?.getApi()) {
          ref.current.getApi().unselect();
        }
        return;
      }
    }

    setBookingCalendarInfo(selectInfo);
  };

  const handleEventSelecting = (selectInfo: DateSelectArg) => {
    // Check if the selection overlaps with any blackout periods
    const bookingStart = dayjs(selectInfo.start);
    const bookingEnd = dayjs(selectInfo.end);
    const selectedResourceId = selectInfo.resource?.id;

    if (selectedResourceId) {
      const roomId = parseInt(selectedResourceId);

      // Use the new time-aware blackout checking
      const { inBlackout } = isBookingTimeInBlackout(bookingStart, bookingEnd, [
        roomId,
      ]);

      if (inBlackout) {
        // Don't allow selection in blackout periods
        return false;
      }
    }

    // Allow selection if not in blackout period
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
    console.log(`Calendar events received:`, existingCalendarEvents.length);
    console.log(
      `Sample events:`,
      existingCalendarEvents.slice(0, 3).map((e) => ({
        id: e.id,
        title: e.title,
        start: e.start,
        end: e.end,
        resourceId: e.resourceId,
      }))
    );

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
    <FullCalendarWrapper data-testid="booking-calendar-wrapper">
      <FullCalendar
        data-testid="booking-calendar"
        initialDate={dateView}
        initialView="resourceTimeGridDay"
        timeZone={TIMEZONE}
        plugins={[
          resourceTimeGridPlugin,
          googleCalendarPlugin,
          interactionPlugin,
        ]}
        selectable={
          formContext !== FormContextLevel.MODIFICATION || isAdminPermission
        }
        select={handleEventSelect}
        selectAllow={handleEventSelecting}
        selectOverlap={handleSelectOverlap}
        selectConstraint={{
          resourceIds: resources.map((r) => r.id),
          overlap: false,
        }}
        eventOverlap={false}
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
        eventStartEditable={
          formContext !== FormContextLevel.MODIFICATION || isAdminPermission
        }
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
