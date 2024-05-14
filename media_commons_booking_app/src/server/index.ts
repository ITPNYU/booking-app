import {
  addEventToCalendar,
  confirmEvent,
  getCalendarEvents,
} from './calendars';
import {
  appendRowActive,
  fetchById,
  getActiveBookingsFutureDates,
  getAllActiveSheetRows,
  getOldSafetyTrainingEmails,
} from './db';
import {
  approvalUrl,
  doGet,
  getActiveUserEmail,
  rejectUrl,
  scriptURL,
} from './ui';
import {
  approveBooking,
  approveInstantBooking,
  cancel,
  checkin,
  noShow,
  reject,
  removeFromListByValue,
  sendBookingDetailEmail,
} from './admin';
import { sendHTMLEmail, sendTextEmail } from './emails';

// Public functions must be exported as named exports
// Interface bewteen server <> client
export {
  // calendars
  addEventToCalendar,
  confirmEvent,
  getCalendarEvents,

  // sheets
  appendRowActive,
  fetchById,
  getAllActiveSheetRows,
  getActiveBookingsFutureDates,
  getOldSafetyTrainingEmails,

  // ui
  scriptURL,
  approvalUrl,
  rejectUrl,
  doGet,
  getActiveUserEmail,

  // email
  sendHTMLEmail,
  sendTextEmail,
  // admin
  approveBooking,
  reject,
  cancel,
  checkin,
  noShow,
  approveInstantBooking,
  removeFromListByValue,
  sendBookingDetailEmail,
};
