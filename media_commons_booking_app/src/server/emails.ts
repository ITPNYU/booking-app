import { Booking, BookingStatusLabel } from '../types';

export const sendTextEmail = (
  targetEmail: string,
  status: BookingStatusLabel,
  eventTitle: string,
  body: string
) => {
  const subj = `${status}: Media Commons request for \"${eventTitle}\"`;
  GmailApp.sendEmail(targetEmail, subj, body);
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
  const subj = `${status}: Media Commons request for \"${eventTitle}\"`;
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
