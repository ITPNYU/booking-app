import { Page } from "@playwright/test";
import { Timestamp } from "../../../lib/firebase/stubs/firebaseFirestoreStub";

export const JSON_HEADERS = { "content-type": "application/json" };

export const TIMESTAMP_FIELDS = [
  "startDate",
  "endDate",
  "requestedAt",
  "firstApprovedAt",
  "finalApprovedAt",
  "declinedAt",
  "canceledAt",
  "checkedInAt",
  "checkedOutAt",
  "noShowedAt",
  "closedAt",
  "walkedInAt",
];

/** Extended timestamp fields that include "By" fields (used by service tests) */
export const TIMESTAMP_FIELDS_WITH_BY = [
  "startDate",
  "endDate",
  "requestedAt",
  "firstApprovedAt",
  "firstApprovedBy",
  "finalApprovedAt",
  "finalApprovedBy",
  "declinedAt",
  "declinedBy",
  "canceledAt",
  "canceledBy",
  "checkedInAt",
  "checkedInBy",
  "checkedOutAt",
  "checkedOutBy",
  "noShowedAt",
  "noShowedBy",
  "closedAt",
  "closedBy",
];

export function createTimestamp(date: Date) {
  const ts = new Timestamp(date);
  (ts as any).toMillis = () => date.getTime();
  (ts as any).toJSON = () => date.toISOString();
  return ts;
}

export function serializeBookingRecord(
  record: any,
  timestampFields: string[] = TIMESTAMP_FIELDS
) {
  const serialized: Record<string, any> = { ...record };

  for (const field of timestampFields) {
    const value = record[field];
    if (value && typeof value.toDate === "function") {
      serialized[field] = value.toDate().toISOString();
    }
  }

  if (record.startDate?.toDate) {
    serialized.startDate = record.startDate.toDate().toISOString();
  }
  if (record.endDate?.toDate) {
    serialized.endDate = record.endDate.toDate().toISOString();
  }
  if (record.requestedAt?.toDate) {
    serialized.requestedAt = record.requestedAt.toDate().toISOString();
  }

  serialized.xstateData = record.xstateData
    ? JSON.parse(JSON.stringify(record.xstateData))
    : undefined;

  return serialized;
}

export function serializeGenericRecord(record: any) {
  const serialized: Record<string, any> = { ...record };

  Object.entries(serialized).forEach(([key, value]) => {
    if (value && typeof (value as any).toDate === "function") {
      serialized[key] = (value as any).toDate().toISOString();
    }
  });

  return serialized;
}

/**
 * Registers an Object.defineProperty interceptor that forces `configurable: true`
 * on targeted webpack exports, allowing later overrides.
 * Must be called BEFORE the main mock initScript.
 */
export async function registerDefinePropertyInterceptor(page: Page) {
  await page.addInitScript(() => {
    const targetExports = new Set([
      "clientGetDataByCalendarEventId",
      "clientFetchAllDataFromCollection",
      "getPaginatedData",
    ]);
    const origDefineProperty = Object.defineProperty;
    Object.defineProperty = function (
      obj: any,
      prop: PropertyKey,
      descriptor: PropertyDescriptor
    ) {
      if (
        descriptor &&
        descriptor.get &&
        !descriptor.configurable &&
        typeof prop === "string" &&
        targetExports.has(prop)
      ) {
        descriptor = { ...descriptor, configurable: true };
      }
      return origDefineProperty.call(this, obj, prop, descriptor);
    } as typeof Object.defineProperty;
    Object.defineProperty.toString = () =>
      "function defineProperty() { [native code] }";
  });
}

/**
 * Checks if a table/collection name refers to bookings (not bookingTypes or bookingLogs).
 * Use inside initScripts by inlining this logic.
 */
export function isBookingsTable(normalizedTableName: string): boolean {
  return (
    normalizedTableName.includes("booking") &&
    !normalizedTableName.includes("type") &&
    !normalizedTableName.includes("log")
  );
}
