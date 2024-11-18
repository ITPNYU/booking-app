import { BookingStatusLabel, DevBranch } from "../types";
import { Tenants, clientGetFinalApproverEmail } from "../policy";

import { getMediaCommonsBookingContents } from "./mediaCommons/email";
import { getStagingBookingContents } from "./staging/email";

export const getEmailBranchTag = () => {
  switch (process.env.NEXT_PUBLIC_BRANCH_NAME as DevBranch) {
    case "development":
      return "[DEV] ";
    case "staging":
      return "[STAGING] ";
    default:
      return "";
  }
};

export const clientSendBookingDetailEmail = async (
  tenant: Tenants,
  calendarEventId: string,
  email: string,
  headerMessage: string,
  status: BookingStatusLabel
) => {
  let contents;
  switch (tenant) {
    case Tenants.MEDIA_COMMONS:
      contents = await getMediaCommonsBookingContents(calendarEventId);
    case Tenants.STAGING:
      contents = await getStagingBookingContents(calendarEventId);
  }
  contents.headerMessage = headerMessage;

  const formData = {
    templateName: "booking_detail",
    contents: contents,
    targetEmail: email,
    status: status,
    eventTitle: contents.title,
    requestNumber: contents.requestNumber ?? "--",
    bodyMessage: "",
  };

  const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/sendEmail`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(formData),
  });
};

export const clientSendConfirmationEmail = async (
  tenant: Tenants,
  calendarEventId: string,
  status: BookingStatusLabel,
  headerMessage: string
) => {
  const email = await clientGetFinalApproverEmail();
  clientSendBookingDetailEmail(
    tenant,
    calendarEventId,
    email,
    headerMessage,
    status
  );
};
