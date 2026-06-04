import type {
  RequestLimitBucketKey,
  RequestLimitPeriod,
  SchemaContextType,
} from "@/components/src/client/routes/components/SchemaProvider";
import { FormContextLevel, Role } from "@/components/src/types";
import { TableNames } from "@/components/src/policy";
import { serverFetchAllDataFromCollection } from "@/lib/firebase/server/adminDb";
import { formatInTimeZone, toDate } from "date-fns-tz";
import { Timestamp } from "firebase-admin/firestore";

/** IANA zone used for request-limit calendar windows (day / week / month / semester). */
export const REQUEST_LIMITS_TIME_ZONE = "America/New_York" as const;

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** Wall-clock calendar parts in {@link REQUEST_LIMITS_TIME_ZONE} for instant `now`. */
function nyCalendarParts(now: Date) {
  const tz = REQUEST_LIMITS_TIME_ZONE;
  return {
    y: Number(formatInTimeZone(now, tz, "yyyy")),
    m: Number(formatInTimeZone(now, tz, "M")) - 1,
    d: Number(formatInTimeZone(now, tz, "d")),
    /** ISO weekday: 1 = Monday … 7 = Sunday */
    isoDow: Number(formatInTimeZone(now, tz, "i")),
  };
}

/** Start of that calendar date at 00:00 in {@link REQUEST_LIMITS_TIME_ZONE} (UTC instant). */
function nyMidnight(y: number, monthIndex0: number, day: number): Date {
  return toDate(
    `${y}-${pad2(monthIndex0 + 1)}-${pad2(day)}T00:00:00.000`,
    { timeZone: REQUEST_LIMITS_TIME_ZONE },
  );
}

export function parseRoleEnumFromLabel(label: string | undefined): Role | undefined {
  if (!label) return undefined;
  const normalized = label.trim().toLowerCase();
  const entries = Object.values(Role) as string[];
  const match = entries.find((v) => v.toLowerCase() === normalized);
  return match as Role | undefined;
}

/**
 * Maps the booking's role (display label → Role enum) to the `requestLimits` map key.
 * VIP / walk-in / full form share the same limits bucket (student / faculty / admin).
 */
export function getRequestLimitRoleKey(
  _formContext: FormContextLevel,
  roleLabel: string | undefined,
): RequestLimitBucketKey {
  const roleEnum = parseRoleEnumFromLabel(roleLabel);
  switch (roleEnum) {
    case Role.FACULTY:
    case Role.RESIDENT_FELLOW:
      return "faculty";
    case Role.ADMIN_STAFF:
    case Role.CHAIR_PROGRAM_DIRECTOR:
      return "admin";
    case Role.STUDENT:
    default:
      return "student";
  }
}

/** Calendar windows for request limits in {@link REQUEST_LIMITS_TIME_ZONE} (handles DST). */
export function getNewYorkWindowForPeriod(
  now: Date,
  period: RequestLimitPeriod,
  termConfig?: SchemaContextType["termConfig"],
): { start: Date; end: Date } {
  const parts = nyCalendarParts(now);
  const { y, m, d, isoDow } = parts;

  if (period === "perDay") {
    const start = nyMidnight(y, m, d);
    const next = new Date(Date.UTC(y, m, d + 1));
    const end = nyMidnight(
      next.getUTCFullYear(),
      next.getUTCMonth(),
      next.getUTCDate(),
    );
    return { start, end };
  }

  if (period === "perWeek") {
    const daysSinceMonday = (isoDow + 6) % 7;
    const startDate = new Date(Date.UTC(y, m, d - daysSinceMonday));
    const endDate = new Date(Date.UTC(y, m, d - daysSinceMonday + 7));
    const start = nyMidnight(
      startDate.getUTCFullYear(),
      startDate.getUTCMonth(),
      startDate.getUTCDate(),
    );
    const end = nyMidnight(
      endDate.getUTCFullYear(),
      endDate.getUTCMonth(),
      endDate.getUTCDate(),
    );
    return { start, end };
  }

  if (period === "perMonth") {
    const start = nyMidnight(y, m, 1);
    const nextMonth = new Date(Date.UTC(y, m + 1, 1));
    const end = nyMidnight(
      nextMonth.getUTCFullYear(),
      nextMonth.getUTCMonth(),
      nextMonth.getUTCDate(),
    );
    return { start, end };
  }

  const month = m + 1;

  const ranges =
    termConfig?.fallTerm && termConfig?.springTerm && termConfig?.summerTerm
      ? [
          { range: termConfig.springTerm },
          { range: termConfig.summerTerm },
          { range: termConfig.fallTerm },
        ]
      : null;

  if (ranges) {
    const inRange = (range: [number, number]) => {
      const [startMonth, endMonth] = range;
      if (
        !Number.isFinite(startMonth) ||
        !Number.isFinite(endMonth) ||
        startMonth < 1 ||
        startMonth > 12 ||
        endMonth < 1 ||
        endMonth > 12 ||
        startMonth > endMonth
      ) {
        return false;
      }
      return month >= startMonth && month <= endMonth;
    };

    const active = ranges.find((r) => inRange(r.range));
    if (active) {
      const [startMonth, endMonth] = active.range;
      const start = nyMidnight(y, startMonth - 1, 1);
      const endExclusive = new Date(Date.UTC(y, endMonth, 1));
      const end = nyMidnight(
        endExclusive.getUTCFullYear(),
        endExclusive.getUTCMonth(),
        endExclusive.getUTCDate(),
      );
      return { start, end };
    }
  }

  const semesterStartMonth0 = Math.floor(m / 4) * 4;
  const start = nyMidnight(y, semesterStartMonth0, 1);
  const endAnchor = new Date(Date.UTC(y, semesterStartMonth0 + 4, 1));
  const end = nyMidnight(
    endAnchor.getUTCFullYear(),
    endAnchor.getUTCMonth(),
    endAnchor.getUTCDate(),
  );
  return { start, end };
}

/** @deprecated Use {@link getNewYorkWindowForPeriod} */
export const getLocalWindowForPeriod = getNewYorkWindowForPeriod;

export function parseRoomIdsFromBooking(doc: any): number[] {
  if (Array.isArray(doc?.roomIds)) {
    return doc.roomIds
      .map((x: any) => Number(x))
      .filter((n: number) => Number.isFinite(n));
  }

  const raw = doc?.roomId;
  if (typeof raw === "string") {
    return raw
      .split(",")
      .map((s) => Number(String(s).trim()))
      .filter((n) => Number.isFinite(n));
  }

  return [];
}

function isUnlimitedLimit(limit: unknown): boolean {
  return limit == null || limit === -1;
}

/**
 * Reads a configured cap from schema (-1 / missing = unlimited).
 * Coerces numeric strings from Firestore (e.g. "0") so limit 0 is enforced.
 */
function parseConfiguredRequestLimit(raw: unknown): number | undefined {
  if (isUnlimitedLimit(raw)) return undefined;
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n) || n < 0) return undefined;
  return n;
}

function getRequestedAtMillis(doc: any): number | null {
  const v = doc?.requestedAt;
  if (!v) return null;
  if (typeof v?.toMillis === "function") return v.toMillis();
  if (v instanceof Date) return v.getTime();
  if (typeof v === "number") return v;
  if (typeof v?.seconds === "number") return v.seconds * 1000;
  return null;
}

function getChangedAtMillis(log: any): number {
  const v = log?.changedAt;
  const ms = getRequestedAtMillis({ requestedAt: v });
  return ms ?? 0;
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function normalizeStatusUpper(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  if (!s) return null;
  return s.toUpperCase();
}

function isTerminalInactiveStatus(statusUpper: string | null): boolean {
  if (!statusUpper) return false;
  return statusUpper === "CANCELED" || statusUpper === "DECLINED";
}

async function getLatestLogStatusByRequestNumber(
  requestNumbers: number[],
  tenant?: string,
): Promise<Map<number, string>> {
  const out = new Map<number, string>();
  if (requestNumbers.length === 0) return out;

  // Firestore `in` supports up to 10 values.
  const batches = chunk(requestNumbers, 10);
  const logs = (
    await Promise.all(
      batches.map((nums) =>
        serverFetchAllDataFromCollection<any>(
          TableNames.BOOKING_LOGS,
          [{ field: "requestNumber", operator: "in", value: nums }],
          tenant,
        ),
      ),
    )
  ).flat();

  const latestByReq = new Map<number, { ms: number; statusUpper: string }>();
  for (const log of logs) {
    const req = Number(log?.requestNumber);
    if (!Number.isFinite(req)) continue;
    const statusUpper = normalizeStatusUpper(log?.status);
    if (!statusUpper) continue;
    const ms = getChangedAtMillis(log);
    const prev = latestByReq.get(req);
    if (!prev || ms >= prev.ms) {
      latestByReq.set(req, { ms, statusUpper });
    }
  }

  for (const [req, v] of latestByReq.entries()) {
    out.set(req, v.statusUpper);
  }
  return out;
}

function isActiveBookingByLastLog({
  booking,
  latestLogStatusByRequestNumber,
}: {
  booking: any;
  latestLogStatusByRequestNumber: Map<number, string>;
}): boolean {
  const req = Number(booking?.requestNumber);
  const last =
    Number.isFinite(req) ? latestLogStatusByRequestNumber.get(req) ?? null : null;

  // Strict "last-log wins": if we have a last log, use it.
  if (last) return !isTerminalInactiveStatus(last);

  // No logs: treat as active (legacy/missing-log bookings should still count).
  return true;
}

export async function enforceRequestLimits({
  tenant,
  email,
  bookingRoleField,
  limitRoleKey,
  selectedRoomIds,
  schema,
}: {
  tenant: string;
  email: string;
  /** Value stored on booking documents (`data.role`), usually the display label (e.g. "Student"). */
  bookingRoleField: string;
  /** Key used in `resource.requestLimits` maps: `student` | `faculty` | `admin` (no origin suffix). */
  limitRoleKey: RequestLimitBucketKey;
  selectedRoomIds: number[];
  schema: SchemaContextType | null;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  if (!schema?.resources || schema.resources.length === 0)
    return { ok: true } as const;

  const resourcesByRoomId = new Map<number, any>();
  for (const r of schema.resources) {
    if (typeof (r as any)?.roomId === "number") {
      resourcesByRoomId.set((r as any).roomId, r);
    }
  }

  const now = new Date();
  const periods: RequestLimitPeriod[] = [
    "perDay",
    "perWeek",
    "perMonth",
    "perSemester",
  ];

  const uniqueSelectedRoomIds = Array.from(new Set(selectedRoomIds)).filter(
    (roomId) => resourcesByRoomId.has(roomId),
  );
  if (uniqueSelectedRoomIds.length === 0) return { ok: true } as const;

  const periodsToQuery = periods.filter((period) =>
    uniqueSelectedRoomIds.some((roomId) => {
      const resource = resourcesByRoomId.get(roomId);
      const raw = resource?.requestLimits?.[period]?.[limitRoleKey];
      return parseConfiguredRequestLimit(raw) !== undefined;
    }),
  );
  if (periodsToQuery.length === 0) return { ok: true } as const;

  const countsByPeriod: Partial<
    Record<RequestLimitPeriod, Map<number, number>>
  > = {};

  // Pre-compute windows so we can bound the Firestore query by the earliest
  // window start. Without this bound, heavy users fetch their full booking
  // history on every request, which dominates the per-request Firestore read
  // count and contributes to App Engine memory pressure.
  // Requires a composite index `(email ASC, requestedAt ASC)` on each
  // tenant's bookings collection — see firestore.indexes.json.
  const windowsByPeriod = new Map<
    RequestLimitPeriod,
    { start: Date; end: Date }
  >();
  for (const period of periodsToQuery) {
    windowsByPeriod.set(
      period,
      getNewYorkWindowForPeriod(now, period, schema.termConfig),
    );
  }
  const earliestWindowStart = Array.from(windowsByPeriod.values()).reduce(
    (min, w) => (w.start.getTime() < min.getTime() ? w.start : min),
    Array.from(windowsByPeriod.values())[0].start,
  );

  const allByEmail = await serverFetchAllDataFromCollection<any>(
    TableNames.BOOKING,
    [
      { field: "email", operator: "==", value: email },
      {
        field: "requestedAt",
        operator: ">=",
        value: Timestamp.fromDate(earliestWindowStart),
      },
    ],
    tenant,
  );

  const requestNumbers = Array.from(
    new Set(
      allByEmail
        .map((b: any) => Number(b?.requestNumber))
        .filter((n: number) => Number.isFinite(n)),
    ),
  );
  const latestLogStatusByRequestNumber =
    await getLatestLogStatusByRequestNumber(requestNumbers, tenant);

  const relevant = allByEmail.filter((d: any) => {
    if (d?.role !== bookingRoleField) return false;
    return isActiveBookingByLastLog({ booking: d, latestLogStatusByRequestNumber });
  });

  for (const period of periodsToQuery) {
    const { start, end } = windowsByPeriod.get(period)!;
    const startMs = start.getTime();
    const endMs = end.getTime();

    const roomCounts = new Map<number, number>();
    for (const doc of relevant) {
      const ms = getRequestedAtMillis(doc);
      if (ms == null) continue;
      if (ms < startMs || ms >= endMs) continue;

      const roomIds = parseRoomIdsFromBooking(doc);
      for (const roomId of roomIds) {
        if (!resourcesByRoomId.has(roomId)) continue;
        roomCounts.set(roomId, (roomCounts.get(roomId) ?? 0) + 1);
      }
    }

    countsByPeriod[period] = roomCounts;
  }

  for (const roomId of uniqueSelectedRoomIds) {
    const resource = resourcesByRoomId.get(roomId);
    if (!resource) continue;

    for (const period of periodsToQuery) {
      const limit = parseConfiguredRequestLimit(
        resource.requestLimits?.[period]?.[limitRoleKey],
      );
      if (limit === undefined) continue;

      const count = countsByPeriod[period]?.get(roomId) ?? 0;
      // Allow another request only when existing active count is strictly below the cap.
      // For limit 0, count < 0 is impossible, so booking is always blocked.
      if (count < limit) continue;

      const resourceName = resource.name ? `"${resource.name}"` : `Room ${roomId}`;
      return {
        ok: false,
        message: `Request limit reached for ${resourceName} (${period}). Limit: ${limit}.`,
      } as const;
    }
  }

  return { ok: true } as const;
}
