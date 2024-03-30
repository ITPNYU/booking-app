import { Booking, Inputs, RoomSetting } from '../../../../types';
import { INSTANT_APPROVAL_ROOMS, TableNames } from '../../../../policy';
import { useContext, useMemo, useState } from 'react';

import { BookingContext } from '../bookingProvider';
import { DatabaseContext } from '../../components/Provider';
import { formatDate } from '@fullcalendar/core';
import { serverFunctions } from '../../../utils/serverFunctions';

export default function useSubmitBooking(): [
  (x: Inputs) => Promise<void>,
  boolean
] {
  const { liaisonUsers, userEmail, reloadBookings, reloadBookingStatuses } =
    useContext(DatabaseContext);
  const { bookingCalendarInfo, department, role, selectedRooms } =
    useContext(BookingContext);

  const [loading, setLoading] = useState(false);

  const firstApprovers = useMemo(
    () =>
      liaisonUsers
        .filter((liaison) => liaison.department === department)
        .map((liaison) => liaison.email),
    [liaisonUsers, department]
  );

  if (!department || !role) {
    console.error('Missing info for submitting booking');
    return [
      (_) =>
        new Promise((resolve, reject) =>
          reject('Missing info for submitting booking')
        ),
      false,
    ];
  }

  const roomCalendarId = (room: RoomSetting) => {
    console.log('ENVIRONMENT:', process.env.CALENDAR_ENV);
    if (process.env.CALENDAR_ENV === 'production') {
      return room.calendarIdProd;
    } else {
      return room.calendarId;
    }
  };

  const sendApprovalEmail = (recipients: string[], contents: Booking) => {
    var subject = 'Approval Request';
    recipients.forEach((recipient) =>
      serverFunctions.sendHTMLEmail(
        'approval_email',
        contents,
        recipient,
        subject,
        ''
      )
    );
  };

  const registerEvent = async (data) => {
    setLoading(true);
    const email = userEmail || data.missingEmail;
    const [room, ...otherRooms] = selectedRooms;
    const selectedRoomIds = selectedRooms.map((r) => r.roomId);
    const otherRoomIds = otherRooms
      .map((r) => roomCalendarId(r))
      .filter((x) => x != null) as string[];

    if (
      bookingCalendarInfo == null ||
      bookingCalendarInfo.startStr == null ||
      bookingCalendarInfo.endStr == null
    ) {
      return;
    }

    let calendarId = roomCalendarId(room);
    if (calendarId == null) {
      console.error('ROOM CALENDAR ID NOT FOUND');
      return;
    }

    // Add the event to the calendar.
    const calendarEventId = await serverFunctions.addEventToCalendar(
      calendarId,
      `[REQUESTED] ${selectedRoomIds.join(', ')} ${department} - ${
        data.firstName
      } ${data.lastName} (${data.netId})`,
      'Your reservation is not yet confirmed. The coordinator will review and finalize your reservation within a few days.',
      bookingCalendarInfo.startStr,
      bookingCalendarInfo.endStr,
      otherRoomIds
    );

    // Record the event to the spread sheet.
    const contents = order.map(function (key) {
      return data[key];
    });

    serverFunctions.appendRowActive(TableNames.BOOKING, [
      calendarEventId,
      selectedRoomIds.join(', '),
      email,
      bookingCalendarInfo.startStr,
      bookingCalendarInfo.endStr,
      ...contents,
      process.env.BRANCH_NAME,
    ]);

    await serverFunctions.appendRowActive(TableNames.BOOKING_STATUS, [
      calendarEventId,
      email,
      formatDate(new Date()),
    ]);

    const isAutoApproval = (selectedRoomIds, data) => {
      // If the selected rooms are all instant approval rooms and the user does not need catering, and hire security, and room setup, then it is auto-approval.
      return (
        selectedRoomIds.every((r) => INSTANT_APPROVAL_ROOMS.includes(r)) &&
        data['catering'] === 'no' &&
        data['hireSecurity'] === 'no' &&
        data['roomSetup'] === 'no'
      );
    };

    if (isAutoApproval(selectedRoomIds, data)) {
      serverFunctions.approveInstantBooking(calendarEventId);
    } else {
      const getApprovalUrl = serverFunctions.approvalUrl(calendarEventId);
      const getRejectedUrl = serverFunctions.rejectUrl(calendarEventId);
      Promise.all([getApprovalUrl, getRejectedUrl]).then((values) => {
        const userEventInputs: Booking = {
          calendarEventId: calendarEventId,
          roomId: selectedRoomIds,
          email: email,
          startDate: bookingCalendarInfo?.startStr,
          endDate: bookingCalendarInfo?.endStr,
          approvalUrl: values[0],
          rejectedUrl: values[1],
          ...data,
        };
        sendApprovalEmail(firstApprovers, userEventInputs);
      });
    }

    alert('Your request has been sent.');

    serverFunctions.sendTextEmail(
      email,
      'Your Request Sent to Media Commons',
      'Your reservation is not yet confirmed. The coordinator will review and finalize your reservation within a few days.'
    );
    setLoading(false);
    reloadBookings();
    reloadBookingStatuses();
  };

  return [registerEvent, loading];
}

const order: (keyof Inputs)[] = [
  'firstName',
  'lastName',
  'secondaryName',
  'nNumber',
  'netId',
  'phoneNumber',
  'department',
  'role',
  'sponsorFirstName',
  'sponsorLastName',
  'sponsorEmail',
  'title',
  'description',
  'expectedAttendance',
  'attendeeAffiliation',
  'roomSetup',
  'setupDetails',
  'mediaServices',
  'mediaServicesDetails',
  'catering',
  'cateringService',
  'hireSecurity',
  'chartFieldForCatering',
  'chartFieldForSecurity',
  'chartFieldForRoomSetup',
];
