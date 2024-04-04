import { appendRowActive, getAllActiveSheetRows } from './db';
import { approveBooking, reject } from './admin';

import { TableNames } from '../policy';

// export const addBookingStatusRequest = (calendarId: string, email: string) => {
//   const row = [calendarId, email, new Date()];
//   appendRowActive(TableNames.BOOKING_STATUS, row);
// };

export const scriptURL = () => {
  const url = ScriptApp.getService().getUrl();
  return url;
};

export const approvalUrl = (calendarId) => {
  const url = ScriptApp.getService().getUrl();
  return `${url}?action=approve&page=admin&calendarId=${calendarId}`;
};

export const rejectUrl = (calendarId) => {
  const url = ScriptApp.getService().getUrl();
  return `${url}?action=reject&page=admin&calendarId=${calendarId}`;
};

export const getActiveUserEmail = () => {
  const user = Session.getActiveUser();
  // user.getUsername() isn't a function
  // console.log('userName', user.getUsername());
  return user.getEmail();
};

// client calls by sending a HTTP GET request to the web app's URL
export const doGet = (e) => {
  console.log('DO GET', JSON.stringify(e));
  var action = e.parameter['action'];
  var calendarId = e.parameter['calendarId'];

  if (action === 'approve') {
    approveBooking(calendarId);
    return HtmlService.createHtmlOutputFromFile('approval');
  } else if (action === 'reject') {
    reject(calendarId);
    return HtmlService.createHtmlOutputFromFile('reject');
  }

  return HtmlService.createHtmlOutputFromFile('index');
};
