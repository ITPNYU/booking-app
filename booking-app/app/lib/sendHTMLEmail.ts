import {
  serverFormatDate,
  serverFormatDateOnly,
} from "@/components/src/client/utils/serverDate";
import { MEDIA_COMMONS_EMAIL } from "@/components/src/mediaCommonsPolicy";
import { admins } from "@/components/src/server/admin";
import { getEmailBranchTag } from "@/components/src/server/emails";
import { ApproverType } from "@/components/src/types";
import { getBookingLogs } from "@/lib/firebase/server/adminDb";
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
  replyTo?: string;
  tenant?: string;
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
    replyTo = MEDIA_COMMONS_EMAIL,
    tenant,
  } = params;

  // Check if we're in development and if the target email is an admin
  const isDevelopment = process.env.NEXT_PUBLIC_BRANCH_NAME === "development";
  let finalTargetEmail = targetEmail;

  if (isDevelopment) {
    const adminUsers = await admins();
    const adminEmails = new Set(adminUsers.map(user => user.email));
    console.log("targetEmail", targetEmail);

    // Only redirect if the email ends with @nyu.edu and is not in admin list
    if (targetEmail.endsWith("@nyu.edu") && !adminEmails.has(targetEmail)) {
      finalTargetEmail = "booking-app-devs+requester@itp.nyu.edu";
    }
  }
  console.log("finalTargetEmail", finalTargetEmail);

  const subj = `${getEmailBranchTag()}${status} - Media Commons Request #${requestNumber}: "${eventTitle}"`;

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

  // Get booking logs
  const bookingLogs = await getBookingLogs(requestNumber, tenant);

  const templatePath = path.join(
    process.cwd(),
    "app/templates",
    `${templateName}.html`,
  );
  const templateSource = fs.readFileSync(templatePath, "utf8");

  // Register date formatting helper
  Handlebars.registerHelper("formatDate", function (timestamp) {
    if (!timestamp) return "";
    try {
      return serverFormatDate(timestamp);
    } catch (error) {
      console.error("Error formatting date:", error);
      return "Invalid Date";
    }
  });

  // Register equality helper
  Handlebars.registerHelper("eq", function (a, b) {
    return a === b;
  });

  const template = Handlebars.compile(templateSource);
  const approvalUrl = approverType
    ? getUrlPathByApproverType(contents.calendarEventId, approverType)
    : undefined;

  // Update contents with formatted data for the template
  const updatedContents = {
    ...contents,
    startDate: serverFormatDateOnly(contents.startDate),
    endDate: serverFormatDateOnly(contents.endDate),
    status: status,
  };

  const htmlBody = template({
    eventTitle,
    status,
    body,
    contents: updatedContents,
    approvalUrl,
    bookingLogs,
  });

  const messageParts = [
    "From: 'Media Commons' <>",
    `To: ${finalTargetEmail}`,
    `Reply-To: ${replyTo}`,
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
    .replace(/={1,2}$/, "");

  const gmail = await getGmailClient();

  await gmail.users.messages.send({
    userId: "me",
    requestBody: {
      raw: encodedMessage,
    },
  });
};
