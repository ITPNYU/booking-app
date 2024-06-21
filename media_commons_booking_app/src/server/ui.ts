import { approveBooking, reject } from './admin';

import { DevBranch } from '../types';

export const scriptUrl = () => {
  const url = ScriptApp.getService().getUrl();
  return url;
};

export const getBookingToolDeployUrl = () => {
  switch (process.env.BRANCH_NAME as DevBranch) {
    case 'development':
      return 'https://sites.google.com/nyu.edu/media-commons-dev/';
    case 'staging':
      return 'https://sites.google.com/nyu.edu/media-commons-staging/';
    default:
      return 'https://sites.google.com/nyu.edu/media-commons-prod/';
  }
};

export const approvalUrl = (calendarEventId: string) => {
  const url = ScriptApp.getService().getUrl();
  return `${url}?action=approve&page=admin&calendarEventId=${calendarEventId}`;
};

export const rejectUrl = (calendarEventId: string) => {
  const url = ScriptApp.getService().getUrl();
  return `${url}?action=reject&page=admin&calendarEventId=${calendarEventId}`;
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
  var calendarEventId = e.parameter['calendarEventId'];

  if (action === 'approve') {
    approveBooking(calendarEventId);
    return HtmlService.createHtmlOutputFromFile('approval');
  } else if (action === 'reject') {
    reject(calendarEventId);
    return HtmlService.createHtmlOutputFromFile('reject');
  }

  return HtmlService.createHtmlOutputFromFile('index');
};
