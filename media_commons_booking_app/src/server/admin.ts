import {
  ActiveSheetBookingStatusColumns,
  SECOND_APPROVER_EMAIL,
  TableNames,
} from '../policy';
import { approvalUrl, rejectUrl } from './ui';
import {
  fetchById,
  fetchIndexById,
  fetchIndexByUniqueValue,
  getActiveSheetValueById,
  removeRowActive,
  updateActiveSheetValueById,
} from './db';
import { inviteUserToCalendarEvent, updateEventPrefix } from './calendars';

import { sendHTMLEmail, sendTextEmail } from './emails';

export const bookingContents = (id: string) => {
  const values = fetchById(TableNames.BOOKING, id);
  return {
    calendarEventId: id,
    roomId: values[2],
    email: values[3],
    startDate: values[4],
    endDate: values[5],
    firstName: values[6],
    lastName: values[7],
    secondaryName: values[8],
    nNumber: values[9],
    netId: values[10],
    phoneNumber: values[11],
    department: values[12],
    role: values[13],
    sponsorFirstName: values[14],
    sponsorLastName: values[15],
    sponsorEmail: values[16],
    reservationTitle: values[17],
    reservationDescription: values[18],
    expectedAttendance: values[19],
    attendeeAffiliation: values[20],
    roomSetup: values[21],
    setupDetails: values[22],
    mediaServices: values[23],
    mediaServicesDetails: values[24],
    catering: values[25],
    cateringService: values[26],

    hireSecurity: values[27],
    chartFieldForCatering: values[28],
    chartFieldForSecurity: values[29],
    chartFieldForRoomSetup: values[30],
    approvalUrl: approvalUrl(id),
    rejectedUrl: rejectUrl(id),
  };
};

export const approveInstantBooking = (id: string) => {
  updateActiveSheetValueById(
    TableNames.BOOKING_STATUS,
    id,
    ActiveSheetBookingStatusColumns.FIRST_APPROVED_DATE,
    new Date()
  );
  approveEvent(id);
};

export const approveBooking = (id: string) => {
  const firstApproveDateRange = updateActiveSheetValueById(
    TableNames.BOOKING_STATUS,
    id,
    ActiveSheetBookingStatusColumns.FIRST_APPROVED_DATE,
    new Date()
  );
  console.log('first approve date', firstApproveDateRange.getValue());

  //COMPLETE ALL APPROVAL
  if (firstApproveDateRange.getValue() !== '') {
    // second approve
    approveEvent(id);
  } else {
    // TODO fix logic here? why are we trying to do this twice?
    // first approve
    updateActiveSheetValueById(
      TableNames.BOOKING_STATUS,
      id,
      ActiveSheetBookingStatusColumns.FIRST_APPROVED_DATE,
      new Date()
    );

    //TODO: send email to user
    updateEventPrefix(id, 'PRE-APPROVED');

    const subject = 'Second Approval Request';
    const contents = bookingContents(id);
    const recipient = SECOND_APPROVER_EMAIL;
    sendHTMLEmail('approval_email', contents, recipient, subject, '');
  }
};

export const approveEvent = (id: string) => {
  // add 2nd approval timestamp
  updateActiveSheetValueById(
    TableNames.BOOKING_STATUS,
    id,
    ActiveSheetBookingStatusColumns.SECOND_APPROVED_DATE,
    new Date()
  );

  const guestEmail = getActiveSheetValueById(
    TableNames.BOOKING_STATUS,
    id,
    ActiveSheetBookingStatusColumns.EMAIL
  );
  sendTextEmail(
    guestEmail,
    'Media Commons Reservation Approved',
    'Your reservation request for Media Commons is approved.'
  );

  updateEventPrefix(id, 'APPROVED');
  inviteUserToCalendarEvent(id, guestEmail);
};

export const reject = (id: string) => {
  updateActiveSheetValueById(
    TableNames.BOOKING_STATUS,
    id,
    ActiveSheetBookingStatusColumns.REJECTED_DATE,
    new Date()
  );

  const guestEmail = getActiveSheetValueById(
    TableNames.BOOKING_STATUS,
    id,
    ActiveSheetBookingStatusColumns.EMAIL
  );
  sendTextEmail(
    guestEmail,
    'Media Commons Reservation Has Been Rejected',
    'Your reservation request for Media Commons has been rejected. For detailed reasons regarding this decision, please contact us at mediacommons.reservations@nyu.edu.'
  );
  updateEventPrefix(id, 'REJECTED');
};

export const cancel = (id: string) => {
  updateActiveSheetValueById(
    TableNames.BOOKING_STATUS,
    id,
    ActiveSheetBookingStatusColumns.CANCELLED_DATE,
    new Date()
  );
  const guestEmail = getActiveSheetValueById(
    TableNames.BOOKING_STATUS,
    id,
    ActiveSheetBookingStatusColumns.EMAIL
  );
  sendTextEmail(
    guestEmail,
    'Media Commons Reservation Has Been Cancelled',
    'Your reservation request for Media Commons has been cancelled. For detailed reasons regarding this decision, please contact us at mediacommons.reservations@nyu.edu.'
  );
  updateEventPrefix(id, 'CANCELLED');
};

export const checkin = (id: string) => {
  updateActiveSheetValueById(
    TableNames.BOOKING_STATUS,
    id,
    ActiveSheetBookingStatusColumns.CHECKED_IN_DATE,
    new Date()
  );
  const guestEmail = getActiveSheetValueById(
    TableNames.BOOKING_STATUS,
    id,
    ActiveSheetBookingStatusColumns.EMAIL
  );
  sendTextEmail(
    guestEmail,
    'Media Commons Reservation Has Been Checked In',
    'Your reservation request for Media Commons has been checked in. Thank you for choosing Media Commons.'
  );
  updateEventPrefix(id, 'CHECKED IN');
};

// assumes the email is in column 0 but that can be overridden
export const removeFromListByEmail = (
  sheetName: TableNames,
  email: string,
  column: number = 0
) => {
  const rowIndex = fetchIndexByUniqueValue(sheetName, column, email);
  console.log('rowIndex to remove:', rowIndex);
  removeRowActive(sheetName, rowIndex);
};
