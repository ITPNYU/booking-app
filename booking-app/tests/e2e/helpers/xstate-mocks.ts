import { Page } from "@playwright/test";
import {
  doc,
  getDoc,
  Timestamp,
} from "../../../lib/firebase/stubs/firebaseFirestoreStub";

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
 * Historical no-op. Overrides used to be injected by rewriting webpack module
 * exports, which required forcing `configurable: true` on their property
 * descriptors. The app now reads overrides straight off `window` (see
 * lib/e2e/clientOverrides.ts), so no descriptor tampering is needed. Kept as
 * an exported function so existing tests don't need to change.
 */
export async function registerDefinePropertyInterceptor(_page: Page) {}

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

/**
 * Compatibility shim. Tests set their override functions on `window` (e.g.
 * `window.clientFetchAllDataFromCollection = ...`) via addInitScript; the
 * app's client fetchers consult `window.<exportName>` on every call in test
 * builds (see lib/e2e/clientOverrides.ts), so the overrides are live the
 * moment they are assigned — no bundler runtime patching required. This
 * helper only keeps the `__applyMockBookingsOverrides` /
 * `__isMockPatchApplied` window API that existing tests still invoke.
 *
 * @param exports - Names of window properties tests intend to override.
 *   Defaults to ['clientFetchAllDataFromCollection'].
 */
export async function registerWebpackPatcher(
  page: Page,
  options: { exports?: string[] } = {},
) {
  const exportNames = options.exports ?? [
    "clientFetchAllDataFromCollection",
  ];

  await page.addInitScript((exportNames: string[]) => {
    (window as any).__applyMockBookingsOverrides = () => {};
    (window as any).__isMockPatchApplied = () =>
      exportNames.some(
        (name) => typeof (window as any)[name] === "function",
      );
  }, exportNames);
}

/**
 * Shared helper that registers the mock bookings feed for xstate E2E tests.
 * Sets up route interception, webpack module patching, and data fetching overrides.
 */
export async function registerMockBookingsFeed(
  page: Page,
  opts: {
    bookingDocId: string;
    calendarEventId: string;
    usersRightsDocId: string;
    adminEmail: string;
    tenant?: string;
  }
) {
  const { bookingDocId, calendarEventId, usersRightsDocId, adminEmail, tenant = "mc" } = opts;

  const snapshot = await getDoc(
    doc({} as any, `${tenant}-bookings`, bookingDocId)
  );
  const baseData = snapshot.data();
  const basePayload = baseData
    ? {
        id: bookingDocId,
        calendarEventId,
        ...serializeBookingRecord(baseData),
      }
    : null;

  const rightsSnapshot = await getDoc(
    doc({} as any, `${tenant}-usersRights`, usersRightsDocId)
  );
  const rightsPayload = rightsSnapshot.data()
    ? {
        id: usersRightsDocId,
        ...serializeGenericRecord(rightsSnapshot.data()),
      }
    : null;

  await page.route("**/api/__mock__/bookings", async (route) => {
    const latestSnapshot = await getDoc(
      doc({} as any, `${tenant}-bookings`, bookingDocId)
    );
    const latestData = latestSnapshot.data();
    const payload = latestData
      ? [
          {
            id: bookingDocId,
            calendarEventId,
            ...serializeBookingRecord(latestData),
          },
        ]
      : [];

    await route.fulfill({
      status: 200,
      headers: JSON_HEADERS,
      body: JSON.stringify(payload),
    });
  });

  await registerDefinePropertyInterceptor(page);

  await page.addInitScript(
    ({
      timestampFields,
      initialBooking,
      initialUsersRights,
      adminEmail,
    }) => {
      const makeTimestamp = (value: string | null | undefined) => {
        if (!value) return null;
        const baseDate = new Date(value);
        return {
          toDate: () => new Date(baseDate),
          toMillis: () => baseDate.getTime(),
          valueOf: () => baseDate.getTime(),
        };
      };

      const enrichBooking = (raw: Record<string, any>) => {
        const booking = { ...raw };
        timestampFields.forEach((field: string) => {
          if (booking[field]) {
            booking[field] = makeTimestamp(booking[field]);
          } else if (
            booking[field] === null ||
            booking[field] === undefined
          ) {
            booking[field] = null;
          }
        });
        if (booking.startDate) {
          booking.startDate = makeTimestamp(booking.startDate);
        }
        if (booking.endDate) {
          booking.endDate = makeTimestamp(booking.endDate);
        }
        if (booking.requestedAt) {
          booking.requestedAt = makeTimestamp(booking.requestedAt);
        }
        return booking;
      };

      async function loadBookings() {
        const response = await fetch("/api/__mock__/bookings");
        const raw = await response.json();
        const bookings = raw.map(enrichBooking);
        (window as any).__mockBookings = bookings;
        (window as any).__bookingE2EMocks = {
          bookings,
          usersRights: (initialUsersRights ? [initialUsersRights] : []).map(
            (record: any) => {
              const enriched = { ...record };
              ["createdAt", "updatedAt"].forEach((field) => {
                if (enriched[field]) {
                  enriched[field] = makeTimestamp(enriched[field]);
                }
              });
              return enriched;
            }
          ),
          usersApprovers: [
            {
              email: adminEmail,
              department: "ITP",
              level: 3,
              createdAt: new Date().toISOString(),
            },
          ],
        };
        return bookings;
      }

      async function ensureBookings() {
        if (!(window as any).__mockBookings) {
          return await loadBookings();
        }
        return (window as any).__mockBookings;
      }

      (window as any).__refreshMockBookings = async () => {
        return await loadBookings();
      };

      const originalClientFetch =
        (window as any).clientFetchAllDataFromCollection;

      const usersRightsRecords = (
        initialUsersRights ? [initialUsersRights] : []
      ).map((record: any) => {
        const enriched = { ...record };
        ["createdAt", "updatedAt"].forEach((field) => {
          if (enriched[field]) {
            enriched[field] = makeTimestamp(enriched[field]);
          }
        });
        return enriched;
      });

      (window as any).__mockUsersRights = usersRightsRecords;

      (window as any).clientFetchAllDataFromCollection = async function (
        tableName: string,
        constraints: unknown[],
        tenant: string
      ) {
        const normalizedTableName = tableName
          ? tableName.toLowerCase()
          : "";

        if (
          normalizedTableName.includes("booking") &&
          !normalizedTableName.includes("type") &&
          !normalizedTableName.includes("log")
        ) {
          return await ensureBookings();
        }

        if (normalizedTableName.includes("usersrights")) {
          return usersRightsRecords;
        }

        if (normalizedTableName.includes("usersapprovers")) {
          return [];
        }

        if (originalClientFetch) {
          return await originalClientFetch(tableName, constraints, tenant);
        }

        return [];
      };

      const originalGetPaginatedData = (window as any).getPaginatedData;

      (window as any).getPaginatedData = async function (
        collectionName: string,
        itemsPerPage: number,
        filters: any,
        lastVisible: any,
        tenant?: string
      ) {
        return await ensureBookings();
      };

      const originalGetDocs = (window as any).getDocs;

      (window as any).getDocs = async function (queryRef: any) {
        const path = queryRef && (queryRef._path || queryRef.path);
        if (
          path &&
          path.includes("booking") &&
          !path.includes("bookingTypes") &&
          !path.includes("bookingLog")
        ) {
          const bookings = await ensureBookings();
          return {
            docs: bookings.map((booking: any) => ({
              id: booking.id ?? booking.calendarEventId,
              data: () => ({ ...booking }),
            })),
          };
        }

        if (path && path.includes("usersRights")) {
          return {
            docs: usersRightsRecords.map(
              (record: any, index: number) => ({
                id: record.id ?? `users-rights-${index}`,
                data: () => ({ ...record }),
              })
            ),
          };
        }

        if (path && path.includes("usersApprovers")) {
          return {
            docs: [],
          };
        }

        if (originalGetDocs) {
          return await originalGetDocs(queryRef);
        }

        return { docs: [] };
      };

      void loadBookings().catch(() => {});

      const overrideClientGetDataById = async (calendarEventId: string) => {
        const bookings = await ensureBookings();
        const match = bookings.find(
          (booking: any) => booking.calendarEventId === calendarEventId
        );
        if (!match) return null;
        return {
          id: match.id ?? match.calendarEventId,
          ...match,
        };
      };

      // The app's client fetchers (lib/firebase/firebase.ts) consult
      // `window.<exportName>` on every call in test builds via
      // getE2EOverride, so exposing the override here is all that's needed —
      // no bundler runtime patching.
      (window as any).clientGetDataByCalendarEventId = async (
        _tableName: any,
        calendarEventId: string,
        _tenant?: string
      ) => {
        return await overrideClientGetDataById(calendarEventId);
      };

      // Back-compat shims: overrides now take effect as soon as they are set
      // on window, but older tests still invoke these before acting.
      (window as any).__applyMockBookingsOverrides = () => {};
      (window as any).__isMockPatchApplied = () =>
        typeof (window as any).clientFetchAllDataFromCollection === "function";
    },
    {
      timestampFields: TIMESTAMP_FIELDS_WITH_BY,
      initialBooking: basePayload,
      initialUsersRights: rightsPayload,
      adminEmail,
    }
  );
}
