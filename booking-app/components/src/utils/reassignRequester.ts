import { BookingOrigin, BookingStatusLabel } from "../types";
import { NET_ID_REGEX } from "./validationHelpers";

/**
 * Statuses in which an admin may hand a booking to a different requester.
 * Checked-in and later statuses are excluded: they record who actually used
 * the space, and no-show / late-cancel violations are tracked by that NetID.
 */
export const REASSIGNABLE_STATUSES: readonly BookingStatusLabel[] = [
  BookingStatusLabel.REQUESTED,
  BookingStatusLabel.PRE_APPROVED,
  BookingStatusLabel.APPROVED,
  BookingStatusLabel.DECLINED,
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

export const reassignmentHistoryNote = (
  previousEmail: string,
  newEmail: string,
): string => `Requester changed from ${previousEmail} to ${newEmail}`;

type StatusMessages = {
  requestedUser?: string;
  approvedUser?: string;
  approvedWalkIn?: string;
  approvedVIP?: string;
  declined?: string;
};

/**
 * Header for the email the new requester gets. It names the change, then
 * repeats the tenant's usual message for the booking's current status, so an
 * approved booking reads as an approval email.
 */
export function newRequesterHeaderMessage(
  status: BookingStatusLabel | string,
  origin: string | undefined,
  messages: StatusMessages,
): string {
  const intro = "This reservation has been assigned to you.";
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
    case BookingStatusLabel.DECLINED:
      statusMessage = messages.declined;
      break;
  }
  return statusMessage?.trim() ? `${intro}<br /><br />${statusMessage}` : intro;
}

export const previousRequesterHeaderMessage = (
  newName: string,
  newEmail: string,
): string =>
  `This reservation has been reassigned to ${newName} (${newEmail}). It no longer appears in your bookings.`;
