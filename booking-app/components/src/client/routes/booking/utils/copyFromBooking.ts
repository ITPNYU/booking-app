import { AttendeeAffiliation, Booking, Inputs } from "../../../../types";

/**
 * The Details step sections a past booking can fill. Each section is copied
 * whole, so a sponsor or contact never ends up half from one booking. Title,
 * production schedule and times belong to one event and are never copied.
 */
export type CopySection = "sponsor" | "secondaryContact" | "reservation";

export type CopyFieldValues = Partial<Record<keyof Inputs, string>>;

export const COPY_SECTION_FIELDS: Record<CopySection, (keyof Inputs)[]> = {
  sponsor: ["sponsorFirstName", "sponsorLastName", "sponsorEmail"],
  secondaryContact: [
    "secondaryFirstName",
    "secondaryLastName",
    "secondaryEmail",
  ],
  reservation: [
    "description",
    "bookingType",
    "attendeeAffiliation",
    "expectedAttendance",
  ],
};

const text = (value: unknown): string =>
  typeof value === "string" ? value.trim() : "";

/** Old bookings stored the secondary contact as one name. */
function splitLegacyName(name: string): [string, string] {
  const [first, ...rest] = name.split(/\s+/);
  return [first ?? "", rest.join(" ")];
}

/**
 * The values a past booking holds for one section, or null when it holds
 * none. Options the tenant no longer offers are left blank rather than
 * copied into a dropdown that cannot show them.
 */
export function getCopyValues(
  booking: Partial<Booking>,
  section: CopySection,
  bookingTypes: string[],
): CopyFieldValues | null {
  let values: CopyFieldValues;
  switch (section) {
    case "sponsor":
      values = {
        sponsorFirstName: text(booking.sponsorFirstName),
        sponsorLastName: text(booking.sponsorLastName),
        sponsorEmail: text(booking.sponsorEmail),
      };
      break;
    case "secondaryContact": {
      let first = text(booking.secondaryFirstName);
      let last = text(booking.secondaryLastName);
      if (!first && !last && text(booking.secondaryName)) {
        [first, last] = splitLegacyName(text(booking.secondaryName));
      }
      values = {
        secondaryFirstName: first,
        secondaryLastName: last,
        secondaryEmail: text(booking.secondaryEmail),
      };
      break;
    }
    case "reservation": {
      const bookingType = text(booking.bookingType);
      const affiliation = text(booking.attendeeAffiliation);
      values = {
        description: text(booking.description),
        bookingType: bookingTypes.includes(bookingType) ? bookingType : "",
        attendeeAffiliation: (
          Object.values(AttendeeAffiliation) as string[]
        ).includes(affiliation)
          ? affiliation
          : "",
        expectedAttendance: text(booking.expectedAttendance),
      };
      break;
    }
  }
  return Object.values(values).some(Boolean) ? values : null;
}

function toDate(value: unknown): Date | null {
  if (!value) return null;
  if (typeof (value as { toDate?: unknown }).toDate === "function") {
    return (value as { toDate: () => Date }).toDate();
  }
  const date = new Date(value as string | number);
  return isNaN(date.getTime()) ? null : date;
}

function bookingRoomIds(booking: Partial<Booking>): string[] {
  return text(booking.roomId)
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
}

/**
 * The most recently requested booking that included any of the given
 * rooms, or null. Bookings without a request time fall back to their start.
 */
export function pickLastBookingForRooms<T extends Partial<Booking>>(
  bookings: T[],
  roomIds: string[],
): T | null {
  const wanted = new Set(roomIds.map(String));
  let best: T | null = null;
  let bestTime = -Infinity;
  for (const booking of bookings) {
    if (!bookingRoomIds(booking).some((id) => wanted.has(id))) continue;
    const time =
      (toDate(booking.requestedAt) ?? toDate(booking.startDate))?.getTime() ??
      -Infinity;
    if (best === null || time > bestTime) {
      best = booking;
      bestTime = time;
    }
  }
  return best;
}

/** "Spring Showcase (Mar 3, 2026)" for the autofill tooltip. */
export function describeBooking(booking: Partial<Booking>): string {
  const title = text(booking.title) || "Untitled booking";
  const start = toDate(booking.startDate);
  const date = start
    ? start.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "";
  return date ? `${title} (${date})` : title;
}
