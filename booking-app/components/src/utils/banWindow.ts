import { TIMEZONE } from "@/components/src/client/utils/date";
import { timestampToEpochMillis } from "@/lib/utils/timestampWire";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";

/** Default temporary-ban length: one week. */
export const DEFAULT_BAN_DURATION_MS = 7 * 24 * 60 * 60 * 1000;

export type BanLike = {
  email?: string | null;
  startsAt?: unknown;
  endsAt?: unknown;
};

export type BanWindowStatus =
  | "permanent"
  | "active"
  | "upcoming"
  | "expired"
  | "invalid";

export function banWindowBounds(ban: BanLike): {
  start: number | null;
  end: number | null;
} {
  return {
    start: timestampToEpochMillis(ban.startsAt),
    end: timestampToEpochMillis(ban.endsAt),
  };
}

/**
 * A row with no start and no end is a permanent ban.
 * A row with only one bound, or an end that is not after the start, does not ban.
 * An otherwise valid window bans only while now is in [start, end).
 */
export function banWindowStatus(
  ban: BanLike,
  now = Date.now(),
): BanWindowStatus {
  const { start, end } = banWindowBounds(ban);
  if (start == null && end == null) return "permanent";
  if (start == null || end == null || end <= start) return "invalid";
  if (now < start) return "upcoming";
  if (now < end) return "active";
  return "expired";
}

export function isActiveBan(ban: BanLike, now = Date.now()): boolean {
  const status = banWindowStatus(ban, now);
  return status === "permanent" || status === "active";
}

/** End instant for a valid timed window. Permanent and invalid rows have none. */
export function banEndMillis(ban: BanLike): number | null {
  const status = banWindowStatus(ban);
  if (status === "permanent" || status === "invalid") return null;
  return banWindowBounds(ban).end;
}

export function findActiveBan<T extends BanLike>(
  bans: T[],
  email: string | null | undefined,
  now = Date.now(),
): T | undefined {
  if (!email?.trim()) return undefined;
  const normalized = email.trim().toLowerCase();
  const matches = bans.filter(
    (ban) =>
      typeof ban.email === "string" &&
      ban.email.trim().toLowerCase() === normalized &&
      isActiveBan(ban, now),
  );
  if (matches.length === 0) return undefined;
  const permanent = matches.find(
    (ban) => banWindowStatus(ban, now) === "permanent",
  );
  if (permanent) return permanent;
  return matches.reduce((latest, ban) => {
    const latestEnd = banEndMillis(latest) ?? 0;
    const end = banEndMillis(ban) ?? 0;
    return end > latestEnd ? ban : latest;
  });
}

/**
 * Add the default ban length to an `datetime-local` value interpreted as
 * Eastern Time, and return another `datetime-local` value in Eastern Time.
 */
export function addBanWindow(
  startLocal: string,
  durationMs = DEFAULT_BAN_DURATION_MS,
): string | null {
  if (!startLocal) return null;
  const start = fromZonedTime(startLocal, TIMEZONE);
  if (Number.isNaN(start.getTime())) return null;
  return formatInTimeZone(
    new Date(start.getTime() + durationMs),
    TIMEZONE,
    "yyyy-MM-dd'T'HH:mm",
  );
}

/** Parse a `datetime-local` value as Eastern Time. */
export function parseBanLocal(value: string): Date | null {
  if (!value) return null;
  const date = fromZonedTime(value, TIMEZONE);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Eastern Time label, matching the admin date format (`yyyy-MM-dd h:mm a`). */
export function formatBanInstant(value: unknown): string {
  const millis = timestampToEpochMillis(value);
  if (millis == null) return "";
  return formatInTimeZone(new Date(millis), TIMEZONE, "yyyy-MM-dd h:mm a");
}
