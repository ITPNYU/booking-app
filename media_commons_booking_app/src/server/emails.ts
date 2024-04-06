import { Booking, BookingStatusLabel, DevBranch } from '../types';

export const sendTextEmail = (
  targetEmail: string,
  status: BookingStatusLabel,
  eventTitle: string,
  body: string
) => {
  const subj = `${status}: Media Commons request for \"${eventTitle}\"`;
  GmailApp.sendEmail(targetEmail, subj, body);
};

const getEmailBranchTag = () => {
  switch (process.env.BRANCH_NAME as DevBranch) {
    case 'development':
      return '[DEV] ';
    case 'staging':
      return '[STAGING] ';
    default:
      return '';
  }
};

export const sendHTMLEmail = (
  templateName: string,
  contents: Booking,
  targetEmail: string,
  status: BookingStatusLabel,
  eventTitle: string,
  body
) => {
  console.log('contents', contents);
  const subj = `${getEmailBranchTag()}${status}: Media Commons request for \"${eventTitle}\"`;
  const htmlTemplate = HtmlService.createTemplateFromFile(templateName);
  for (const key in contents) {
    htmlTemplate[key] = contents[key] || '';
  }
  const htmlBody = htmlTemplate.evaluate().getContent();
  const options = {
    htmlBody,
  };
  GmailApp.sendEmail(targetEmail, subj, body, options);
};
