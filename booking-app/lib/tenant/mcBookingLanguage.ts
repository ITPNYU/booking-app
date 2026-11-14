/**
 * Media Commons booking-flow and email copy.
 *
 * The live text is stored on `tenantSchema/mc` (`policy` and
 * `emailNotifications`). `scripts/updateMcBookingLanguage.ts` writes this
 * snapshot. Issues: #1418 (policy modal), #1439 (Approved and No Show
 * emails), #1267 (Requested email to the requestor).
 *
 * The policy link uses mediacommons.reservations@nyu.edu. Issue #1418 wrote
 * "medicommons" (missing an "a"); every other Media Commons address uses
 * the spelling with the "a".
 */

import { getBookingToolDeployUrl } from "@/components/src/server/ui";

const POLICY_LINK =
  "https://sites.google.com/nyu.edu/370jmediacommons/about/our-policy";
const RESERVATIONS_EMAIL = "mediacommons.reservations@nyu.edu";

export type McBookingEnvironment = "development" | "staging" | "production";

/** Dashboard link for the environment whose schema is being updated. */
export const requestDashboardUrl = (environment: McBookingEnvironment) => {
  const origin = getBookingToolDeployUrl(environment).replace(/\/$/, "");
  return `${origin}/mc/admin`;
};

const DASHBOARD_ANCHOR =
  /<a href="https:\/\/[^"]+\/mc\/admin">dashboard<\/a>/;

export const requestedUserEmail = (environment: McBookingEnvironment) => {
  const dashboardUrl = requestDashboardUrl(environment);
  return `Your request has been received! Please allow 3-5 days for review.<br /><br />
You can view your booking request's status on your <a href="${dashboardUrl}">dashboard</a> while we review. Here is what each status means:<br /><br />
<b>Requested:</b> Your request has been received, and your department needs to review.<br />
<b>Pre-approved:</b> Your department has completed their review, and now the Media Commons team needs to do a policy and service request review.<br />
<b>Approved:</b> Review is complete and your reservation is confirmed. You will receive a confirmation email and Google Calendar invite.<br /><br />
If there are changes to your request or you would like to follow up, contact <a href="mailto:${RESERVATIONS_EMAIL}">${RESERVATIONS_EMAIL}</a>.<br /><br />
Thank you!`;
};

export const MC_POLICY_HTML = `
    <p style="font-size: 1rem; line-height: 1.5; margin-top: 16px;">
      For the complete details, see our
      <a href="${POLICY_LINK}" target="_blank" rel="noopener noreferrer">full policy document</a>.
    </p>
    <p style="font-weight: 700; font-size: 1rem; line-height: 1.5; margin-top: 24px;">
      Policy Highlights
    </p>
    <ul style="font-size: 1rem; line-height: 1.5; margin: 8px 0 0; padding-left: 24px; list-style-type: disc;">
      <li style="margin-bottom: 12px;">
        <b>Access:</b> Before submitting a request, please review your access. The facilities in 370J Media Commons are intended primarily for use by programs within the building.
      </li>
      <li style="margin-bottom: 12px;">
        <b>Booking Confirmation:</b> After your request is reviewed, you'll receive an email response from the Media Commons Team and a calendar invite if your request is approved. Please allow at least 3 days for review. Submitting a request does not guarantee a reservation. If you don't hear back, email
        <a href="mailto:${RESERVATIONS_EMAIL}">${RESERVATIONS_EMAIL}</a>.
      </li>
      <li>
        <b>Cancellation Policy:</b> If you need to cancel, please do so in the booking tool dashboard <b>at least 24 hours</b> before your reservation date. Late or missed cancellations may result in restricted use of the Media Commons.
      </li>
    </ul>`.trim();

const APPROVED_CHECK_IN_FROM =
  'For reservations in room 1201, you can go straight to the 12th floor without checking in. You can reply to this email to adjust your reservation time if plans change and you will be arriving later.';

const APPROVED_CHECK_IN_TO =
  "For events in the 1201 Seminar Room or 202 Lecture Hall, you can go directly to the room without checking in. Reply to this email to adjust your reservation time if plans change and you will be arriving later.";

const NO_SHOW_FROM =
  "You have been marked as a 'No Show' and your reservation has been canceled due to not checking in within the first 30 minutes of your reservation.";

const NO_SHOW_TO =
  "You have been marked as a 'No Show' and your reservation has been canceled due to not checking in at the Media Commons Front Desk within the first 30 minutes of your reservation. If you believe this is a mistake, or would like to request for this No Show to be waived, please reply to this email.";

const OLD_POLICY_MARKER = "A request does not guarantee a booking.";
const NEW_POLICY_MARKER = "Policy Highlights";
const OLD_REQUESTED_MARKER = "This email does not confirm your reservation.";
const NEW_REQUESTED_MARKER = "Here is what each status means:";

export interface McBookingLanguageInput {
  policy?: string;
  emailNotifications?: Record<string, string> | null;
}

export interface McBookingLanguageResult {
  policy: string;
  emailNotifications: Record<string, string>;
  changes: string[];
  errors: string[];
}

const replaceMarked = (
  label: string,
  current: string | undefined,
  from: string,
  to: string,
): { value: string; change?: string; error?: string } => {
  const value = current ?? "";
  const hasNew = value.includes(to);
  const hasOld = value.includes(from);
  if (hasNew && !hasOld) return { value };
  if (hasOld && !hasNew) {
    return { value: value.replace(from, to), change: label };
  }
  return {
    value,
    error: hasNew
      ? `${label} contains both the old and new copy`
      : `${label} does not contain the expected sentence to replace`,
  };
};

/**
 * Returns the Media Commons policy and email fields with the updated copy
 * applied. A second call on the result reports no changes. Drifted text that
 * matches neither the previous nor the new copy is reported in `errors` and
 * left unchanged.
 */
export const applyMcBookingLanguage = (
  current: McBookingLanguageInput,
  environment: McBookingEnvironment,
): McBookingLanguageResult => {
  const changes: string[] = [];
  const errors: string[] = [];
  const emails = { ...(current.emailNotifications ?? {}) };

  const policy = current.policy ?? "";
  const policyHasNew = policy.includes(NEW_POLICY_MARKER);
  const policyHasOld = policy.includes(OLD_POLICY_MARKER);
  let nextPolicy = policy;
  if (policyHasNew && !policyHasOld) {
    // already updated
  } else if (policyHasOld && !policyHasNew) {
    nextPolicy = MC_POLICY_HTML;
    changes.push("policy");
  } else {
    errors.push(
      policyHasNew
        ? "policy contains both the old and new copy"
        : "policy does not contain the expected Media Commons policy text",
    );
  }

  const requested = emails.requestedUser ?? "";
  const requestedHasNew = requested.includes(NEW_REQUESTED_MARKER);
  const requestedHasOld = requested.includes(OLD_REQUESTED_MARKER);
  const dashboardLink = `<a href="${requestDashboardUrl(environment)}">dashboard</a>`;
  if (requestedHasNew && !requestedHasOld) {
    if (!requested.includes(dashboardLink)) {
      if (!DASHBOARD_ANCHOR.test(requested)) {
        errors.push(
          "emailNotifications.requestedUser is missing the dashboard link",
        );
      } else {
        emails.requestedUser = requested.replace(DASHBOARD_ANCHOR, dashboardLink);
        changes.push("emailNotifications.requestedUser");
      }
    }
  } else if (requestedHasOld && !requestedHasNew) {
    emails.requestedUser = requestedUserEmail(environment);
    changes.push("emailNotifications.requestedUser");
  } else {
    errors.push(
      requestedHasNew
        ? "emailNotifications.requestedUser contains both the old and new copy"
        : "emailNotifications.requestedUser does not contain the expected Requested email",
    );
  }

  const approved = replaceMarked(
    "emailNotifications.approvedUser",
    emails.approvedUser,
    APPROVED_CHECK_IN_FROM,
    APPROVED_CHECK_IN_TO,
  );
  emails.approvedUser = approved.value;
  if (approved.change) changes.push(approved.change);
  if (approved.error) errors.push(approved.error);

  const noShow = replaceMarked(
    "emailNotifications.noShow",
    emails.noShow,
    NO_SHOW_FROM,
    NO_SHOW_TO,
  );
  emails.noShow = noShow.value;
  if (noShow.change) changes.push(noShow.change);
  if (noShow.error) errors.push(noShow.error);

  return {
    policy: nextPolicy,
    emailNotifications: emails,
    changes,
    errors,
  };
};
