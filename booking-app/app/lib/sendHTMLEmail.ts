import { serverFormatDate } from "@/components/src/client/utils/serverDate";
import { getEmailBranchTag } from "@/components/src/server/emails";
import { ApproverType } from "@/components/src/types";
import { getGmailClient } from "@/lib/googleClient";
import fs from "fs";
import path from "path";

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
  approverType?: ApproverType;
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
    approverType,
  } = params;

  const subj = `${getEmailBranchTag()}${status} - Media Commons request #${requestNumber}: "${eventTitle}"`;

  const getUrlPathByApproverType = (
    calendarEventId,
    approverType?: ApproverType,
  ): string => {
    let path: string;
    switch (approverType) {
      case ApproverType.LIAISON:
        path = "/liaison";
        break;
      case ApproverType.FINAL_APPROVER:
        path = "/admin";
        break;
      default:
        path = "/";
    }

    return `${process.env.NEXT_PUBLIC_BASE_URL}${path}?calendarEventId=${calendarEventId}`;
  };

  const templatePath = path.join(
    process.cwd(),
    "app/templates",
    `${templateName}.html`,
  );
  const templateSource = fs.readFileSync(templatePath, "utf8");
  const template = Handlebars.compile(templateSource);
  const approvalUrl = getUrlPathByApproverType(
    contents.calendarEventId,
    approverType,
  );

  const htmlBody = template({
    eventTitle,
    status,
    body,
    contents,
    startDate: serverFormatDate(contents.startDate),
    endDate: serverFormatDate(contents.endDate),
    approvalUrl,
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
