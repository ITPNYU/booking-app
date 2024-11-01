import { approvalUrl, declineUrl } from "@/components/src/server/ui";

import fs from "fs";
import { getEmailBranchTag } from "@/components/src/server/emails";
import { getGmailClient } from "@/lib/googleClient";
import path from "path";
import { serverFormatDate } from "@/components/src/client/utils/serverDate";

let Handlebars;

if (typeof window === "undefined") {
  // Import Handlebars
  Handlebars = require("handlebars");
}
interface BookingFormDetails {
  [key: string]: string;
}

interface SendHTMLEmailParams {
  templateName: string;
  contents: BookingFormDetails;
  targetEmail: string;
  status: string;
  eventTitle: string;
  requestNumber: number;
  body: string;
}

export const sendHTMLEmail = async (params: SendHTMLEmailParams) => {
  const {
    templateName,
    contents,
    targetEmail,
    status,
    eventTitle,
    requestNumber,
    body,
  } = params;

  const subj = `${getEmailBranchTag()}${status} - Media Commons request #${requestNumber}: "${eventTitle}"`;

  const templatePath = path.join(
    process.cwd(),
    "app/templates",
    `${templateName}.html`,
  );
  const templateSource = fs.readFileSync(templatePath, "utf8");
  const template = Handlebars.compile(templateSource);

  const htmlBody = template({
    eventTitle,
    status,
    body,
    contents,
    startDate: serverFormatDate(contents.startDate),
    endDate: serverFormatDate(contents.endDate),
    approvalUrl: approvalUrl(contents.calendarEventId),
    declineUrl: declineUrl(contents.calendarEventId),
  });

  const messageParts = [
    "From: 'Media Commons' <>",
    `To: ${targetEmail}`,
    "Content-Type: text/html; charset=utf-8",
    "MIME-Version: 1.0",
    `Subject: ${subj}`,
    "",
    htmlBody,
  ];
  const message = messageParts.join("\n");

  const encodedMessage = Buffer.from(message)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  const gmail = await getGmailClient();

  await gmail.users.messages.send({
    userId: "me",
    requestBody: {
      raw: encodedMessage,
    },
  });
};
