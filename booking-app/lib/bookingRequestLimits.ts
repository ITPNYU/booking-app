import type {
  RequestLimitPeriod,
  SchemaContextType,
} from "@/components/src/client/routes/components/SchemaProvider";
import { FormContextLevel, Role } from "@/components/src/types";
import { TableNames } from "@/components/src/policy";
import { serverFetchAllDataFromCollection } from "@/lib/firebase/server/adminDb";
import { buildCalendarConfigKey } from "@/components/src/client/routes/booking/utils/buildCalendarConfigKey";

export function parseRoleEnumFromLabel(label: string | undefined): Role | undefined {
  if (!label) return undefined;
  const normalized = label.trim().toLowerCase();
  const entries = Object.values(Role) as string[];
  const match = entries.find((v) => v.toLowerCase() === normalized);
  return match as Role | undefined;
}

export function getRequestLimitRoleKey(
  formContext: FormContextLevel,
  roleLabel: string | undefined,
): string {
  const roleEnum = parseRoleEnumFromLabel(roleLabel);
  return buildCalendarConfigKey(formContext, roleEnum);
}

export function getUtcWindowForPeriod(
  now: Date,
  period: RequestLimitPeriod,
  termConfig?: SchemaContextType["termConfig"],
): { start: Date; end: Date } {
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth(); // 0-11
  const d = now.getUTCDate();

  if (period === "perDay") {
    const start = new Date(Date.UTC(y, m, d, 0, 0, 0, 0));
    const end = new Date(Date.UTC(y, m, d + 1, 0, 0, 0, 0));
    return { start, end };
  }

  if (period === "perWeek") {
    const dayOfWeek = now.getUTCDay();
    const daysSinceMonday = (dayOfWeek + 6) % 7;
    const start = new Date(Date.UTC(y, m, d - daysSinceMonday, 0, 0, 0, 0));
    const end = new Date(Date.UTC(y, m, d - daysSinceMonday + 7, 0, 0, 0, 0));
    return { start, end };
  }

  if (period === "perMonth") {
    const start = new Date(Date.UTC(y, m, 1, 0, 0, 0, 0));
    const end = new Date(Date.UTC(y, m + 1, 1, 0, 0, 0, 0));
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
      const start = new Date(Date.UTC(y, startMonth - 1, 1, 0, 0, 0, 0));
      const endYear = endMonth === 12 ? y + 1 : y;
      const endMonthIndex = endMonth === 12 ? 0 : endMonth;
      const end = new Date(Date.UTC(endYear, endMonthIndex, 1, 0, 0, 0, 0));
      return { start, end };
    }
  }

  const semesterStartMonth = Math.floor(m / 4) * 4;
  const start = new Date(Date.UTC(y, semesterStartMonth, 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(y, semesterStartMonth + 4, 1, 0, 0, 0, 0));
  return { start, end };
}

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
  /** Key used in `resource.requestLimits` maps (e.g. "studentVIP"). */
  limitRoleKey: string;
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

  // Avoid requiring Firestore composite indexes across tenants/environments by only
  // querying on `email` (single-field index) and filtering the rest in memory.
  const allByEmail = await serverFetchAllDataFromCollection<any>(
    TableNames.BOOKING,
    [{ field: "email", operator: "==", value: email }],
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
    const { start, end } = getUtcWindowForPeriod(now, period, schema.termConfig);
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
