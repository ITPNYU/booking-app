import {
  ActiveSheetBookingStatusColumns,
  TableNames,
  getSecondApproverEmail,
} from '../policy';
import { BookingFormDetails, BookingStatusLabel } from '../types';
import { approvalUrl, rejectUrl } from './ui';
import {
  fetchById,
  fetchIndexByUniqueValue,
  getActiveSheetValueById,
  removeRowActive,
  updateActiveSheetValueById,
} from './db';
import { inviteUserToCalendarEvent, updateEventPrefix } from './calendars';

import { sendHTMLEmail } from './emails';

export const bookingContents = (id: string): BookingFormDetails => {
  const bookingObj = fetchById(TableNames.BOOKING, id);
  bookingObj.approvalUrl = approvalUrl(id);
  bookingObj.rejectedUrl = rejectUrl(id);
  return bookingObj;
};

const firstApprove = (id: string) =>
  updateActiveSheetValueById(
    TableNames.BOOKING_STATUS,
    id,
    ActiveSheetBookingStatusColumns.FIRST_APPROVED_DATE,
    new Date()
  );

const secondApprove = (id: string) =>
  updateActiveSheetValueById(
    TableNames.BOOKING_STATUS,
    id,
    ActiveSheetBookingStatusColumns.SECOND_APPROVED_DATE,
    new Date()
  );

export const approveInstantBooking = (id: string) => {
  firstApprove(id);
  secondApprove(id);
  approveEvent(id);
};

// both first approve and second approve flows hit here
export const approveBooking = (id: string) => {
  const firstApproveDateRange = getActiveSheetValueById(
    TableNames.BOOKING_STATUS,
    id,
    ActiveSheetBookingStatusColumns.FIRST_APPROVED_DATE
  );

  console.log('first approve date', firstApproveDateRange);

  // if already first approved, then this is a second approve
  if (firstApproveDateRange !== '') {
    secondApprove(id);
    approveEvent(id);
  } else {
    firstApprove(id);

    updateEventPrefix(id, BookingStatusLabel.PRE_APPROVED);

    const contents = bookingContents(id);
    const emailContents = {
      headerMessage: 'This is a request email for final approval.',
      ...contents,
    };
    const recipient = getSecondApproverEmail(process.env.BRANCH_NAME);
    sendHTMLEmail(
      'approval_email',
      emailContents,
      recipient,
      BookingStatusLabel.PRE_APPROVED,
      contents.title,
      ''
    );
  }
};

export const sendConfirmationEmail = (
  calendarEventId: string,
  status: BookingStatusLabel,
  headerMessage
) => {
  const email = getSecondApproverEmail(process.env.BRANCH_NAME);
  sendBookingDetailEmail(calendarEventId, email, headerMessage, status);
};

export const sendBookingDetailEmail = (
  calendarEventId: string,
  email: string,
  headerMessage: string,
  status: BookingStatusLabel
) => {
  const contents = bookingContents(calendarEventId);
  contents.headerMessage = headerMessage;
  sendHTMLEmail('booking_detail', contents, email, status, contents.title, '');
};

export const approveEvent = (id: string) => {
  const guestEmail = getActiveSheetValueById(
    TableNames.BOOKING_STATUS,
    id,
    ActiveSheetBookingStatusColumns.EMAIL
  );

  // for user
  const headerMessage =
    'Your reservation request for Media Commons is approved.';
  console.log('sending booking detail email...');
  sendBookingDetailEmail(
    id,
    guestEmail,
    headerMessage,
    BookingStatusLabel.APPROVED
  );
  // for second approver
  sendConfirmationEmail(
    id,
    BookingStatusLabel.APPROVED,
    `This is a confirmation email.`
  );

  const contents = bookingContents(id);
  updateEventPrefix(id, BookingStatusLabel.APPROVED, contents);
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
  const headerMessage =
    'Your reservation request for Media Commons has been rejected. For detailed reasons regarding this decision, please contact us at mediacommons.reservations@nyu.edu.';
  sendBookingDetailEmail(
    id,
    guestEmail,
    headerMessage,
    BookingStatusLabel.REJECTED
  );
  updateEventPrefix(id, BookingStatusLabel.REJECTED);
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
  const headerMessage =
    'Your reservation request for Media Commons has been cancelled. For detailed reasons regarding this decision, please contact us at mediacommons.reservations@nyu.edu.';
  sendBookingDetailEmail(
    id,
    guestEmail,
    headerMessage,
    BookingStatusLabel.CANCELED
  );
  sendConfirmationEmail(
    id,
    BookingStatusLabel.CANCELED,
    `This is a cancelation email.`
  );
  updateEventPrefix(id, BookingStatusLabel.CANCELED);
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

  const headerMessage =
    'Your reservation request for Media Commons has been checked in. Thank you for choosing Media Commons.';
  sendBookingDetailEmail(
    id,
    guestEmail,
    headerMessage,
    BookingStatusLabel.CHECKED_IN
  );
  updateEventPrefix(id, BookingStatusLabel.CHECKED_IN);
};

export const noShow = (id: string) => {
  updateActiveSheetValueById(
    TableNames.BOOKING_STATUS,
    id,
    ActiveSheetBookingStatusColumns.NO_SHOWED_DATE,
    new Date()
  );
  const guestEmail = getActiveSheetValueById(
    TableNames.BOOKING_STATUS,
    id,
    ActiveSheetBookingStatusColumns.EMAIL
  );

  const headerMessage =
    'You did not check-in for your Media Commons Reservation and have been marked as a no-show.';
  sendBookingDetailEmail(
    id,
    guestEmail,
    headerMessage,
    BookingStatusLabel.NO_SHOW
  );
  sendConfirmationEmail(
    id,
    BookingStatusLabel.NO_SHOW,
    `This is a no show email.`
  );
  updateEventPrefix(id, BookingStatusLabel.NO_SHOW);
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
