import {
  DEFAULT_REASSIGNED_PREVIOUS_USER_MESSAGE,
  DEFAULT_REASSIGNED_USER_MESSAGE,
  NEW_REQUESTER_PLACEHOLDER,
} from "../constants/reassignEmails";
import { BookingOrigin, BookingStatusLabel } from "../types";
import { NET_ID_REGEX } from "./validationHelpers";

/**
 * Statuses in which an admin may hand a booking to a different requester.
 * Checked-in and later statuses are excluded: they record who actually used
 * the space, and no-show / late-cancel violations are tracked by that NetID.
 * Declined is excluded too: the reassignment writes a MODIFIED history row,
 * and the late-cancel check and the request-limit count read "declined" from
 * the newest history row, so they would stop treating the booking as declined.
 */
export const REASSIGNABLE_STATUSES: readonly BookingStatusLabel[] = [
  BookingStatusLabel.REQUESTED,
  BookingStatusLabel.PRE_APPROVED,
  BookingStatusLabel.APPROVED,
];

export const canReassignRequester = (status: unknown): boolean =>
  REASSIGNABLE_STATUSES.includes(status as BookingStatusLabel);

/** Same rule as the Details step's phone field. */
export const PHONE_NUMBER_REGEX =
  /^\(?([2-9][0-8][0-9])\)?[-. ]?([2-9][0-9]{2})[-. ]?([0-9]{4})$/;

export const N_NUMBER_REGEX = /^N[0-9]{8}$/;

export const REASSIGN_NAME_MAX_LEN = 100;

export type ReassignRequesterInput = {
  calendarEventId: string;
  netId: string;
  firstName: string;
  lastName: string;
  nNumber: string;
  phoneNumber: string;
  notifyNewRequester: boolean;
  notifyPreviousRequester: boolean;
};

type ValidationResult =
  | { ok: true; value: ReassignRequesterInput }
  | { ok: false; error: string };

const trimmed = (value: unknown): string =>
  typeof value === "string" ? value.trim() : "";

/** Validates and normalizes the body of PUT /api/bookings/reassign. */
export function validateReassignRequesterInput(
  body: Record<string, unknown> | null | undefined,
): ValidationResult {
  const input = body ?? {};
  const calendarEventId = trimmed(input.calendarEventId);
  if (!calendarEventId) {
    return { ok: false, error: "calendarEventId required" };
  }

  const netId = trimmed(input.netId).toLowerCase();
  if (!NET_ID_REGEX.test(netId)) {
    return { ok: false, error: "Enter a valid NYU NetID (e.g. abc123)" };
  }

  const firstName = trimmed(input.firstName);
  const lastName = trimmed(input.lastName);
  if (!firstName || !lastName) {
    return { ok: false, error: "First and last name are required" };
  }
  if (
    firstName.length > REASSIGN_NAME_MAX_LEN ||
    lastName.length > REASSIGN_NAME_MAX_LEN
  ) {
    return {
      ok: false,
      error: `Names must be at most ${REASSIGN_NAME_MAX_LEN} characters`,
    };
  }

  const phoneNumber = trimmed(input.phoneNumber);
  if (!PHONE_NUMBER_REGEX.test(phoneNumber)) {
    return {
      ok: false,
      error: "Enter a valid 10 digit phone number",
    };
  }

  const nNumber = trimmed(input.nNumber);
  if (nNumber && !N_NUMBER_REGEX.test(nNumber)) {
    return { ok: false, error: "Invalid N-Number" };
  }

  return {
    ok: true,
    value: {
      calendarEventId,
      netId,
      firstName,
      lastName,
      nNumber,
      phoneNumber,
      // Both notifications are on unless the admin turned them off.
      notifyNewRequester: input.notifyNewRequester !== false,
      notifyPreviousRequester: input.notifyPreviousRequester !== false,
    },
  };
}

export const requesterEmailForNetId = (netId: string): string =>
  `${netId.trim().toLowerCase()}@nyu.edu`;

/**
 * Firestore update for handing `booking` to the requester in `input`.
 *
 * Writes the requester fields My Bookings, edit ownership and every later
 * email read (`email`, `netId`, name, N-number, phone) and, on walk-ins, the
 * walk-in NetID the booking's email came from. Role, department, school and
 * sponsor stay as they are: they decide who approves the booking.
 *
 * The saved machine context gets the same values through dotted field paths
 * so its copy is not stale. The machines re-read `email` from the booking on
 * every restore, so this is for consistency only.
 */
export function buildRequesterUpdates(
  booking: Record<string, any>,
  input: Pick<
    ReassignRequesterInput,
    "netId" | "firstName" | "lastName" | "nNumber" | "phoneNumber"
  >,
): Record<string, unknown> {
  const email = requesterEmailForNetId(input.netId);
  const identity: Record<string, string> = {
    netId: input.netId,
    firstName: input.firstName,
    lastName: input.lastName,
    nNumber: input.nNumber,
    phoneNumber: input.phoneNumber,
  };
  const updates: Record<string, unknown> = { email, ...identity };

  const hasWalkInNetId = (value: unknown) =>
    typeof value === "string" && value.trim().length > 0;
  if (hasWalkInNetId(booking.walkInNetId)) {
    updates.walkInNetId = input.netId;
  }

  const context = booking.xstateData?.snapshot?.context;
  if (context && typeof context === "object") {
    const contextPath = "xstateData.snapshot.context";
    updates[`${contextPath}.email`] = email;
    const formData = context.formData;
    if (formData && typeof formData === "object") {
      for (const [field, value] of Object.entries(identity)) {
        updates[`${contextPath}.formData.${field}`] = value;
      }
      if ("email" in formData) {
        updates[`${contextPath}.formData.email`] = email;
      }
      if (hasWalkInNetId(formData.walkInNetId)) {
        updates[`${contextPath}.formData.walkInNetId`] = input.netId;
      }
    }
  }

  return updates;
}

/**
 * Subject word for both reassignment emails, so they read
 * "REASSIGNED - <Tenant> Request #N" instead of the booking's status and are
 * not mistaken for an ordinary status email in the inbox.
 */
export const REASSIGNED_EMAIL_SUBJECT_STATUS = "REASSIGNED";

export const reassignmentHistoryNote = (
  previousEmail: string,
  newEmail: string,
): string => `Requester changed from ${previousEmail} to ${newEmail}`;

type ReassignmentMessages = {
  requestedUser?: string;
  approvedUser?: string;
  approvedWalkIn?: string;
  approvedVIP?: string;
  reassignedUser?: string;
  reassignedPreviousUser?: string;
};

const orDefault = (text: string | undefined, fallback: string) =>
  text?.trim() ? text : fallback;

/**
 * Header for the email the new requester gets: the tenant's
 * `reassignedUser` text, then the tenant's usual message for the booking's
 * current status, so an approved booking reads as an approval email.
 */
export function newRequesterHeaderMessage(
  status: BookingStatusLabel | string,
  origin: string | undefined,
  messages: ReassignmentMessages,
): string {
  const intro = orDefault(
    messages.reassignedUser,
    DEFAULT_REASSIGNED_USER_MESSAGE,
  );
  let statusMessage = "";
  switch (status) {
    case BookingStatusLabel.APPROVED:
      statusMessage =
        origin === BookingOrigin.WALK_IN
          ? messages.approvedWalkIn
          : origin === BookingOrigin.VIP
            ? messages.approvedVIP
            : messages.approvedUser;
      break;
    case BookingStatusLabel.REQUESTED:
    case BookingStatusLabel.PRE_APPROVED:
      statusMessage = messages.requestedUser;
      break;
  }
  return statusMessage?.trim() ? `${intro}<br /><br />${statusMessage}` : intro;
}

/**
 * Header for the email the previous requester gets: the tenant's
 * `reassignedPreviousUser` text with `${newRequester}` replaced by the new
 * requester's name and email.
 */
export const previousRequesterHeaderMessage = (
  messages: ReassignmentMessages,
  newName: string,
  newEmail: string,
): string =>
  orDefault(
    messages.reassignedPreviousUser,
    DEFAULT_REASSIGNED_PREVIOUS_USER_MESSAGE,
  )
    .split(NEW_REQUESTER_PLACEHOLDER)
    .join(`${newName} (${newEmail})`);
