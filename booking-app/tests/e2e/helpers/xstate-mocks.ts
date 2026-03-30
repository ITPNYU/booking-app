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

/**
 * Registers a webpack module patcher that overrides specified exports.
 * Each test should first set its override functions on `window` (e.g.
 * `window.clientFetchAllDataFromCollection = ...`) via addInitScript,
 * then call this helper to patch those overrides into webpack modules.
 *
 * @param exports - Names of window properties to patch into webpack modules.
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
    const buildOverrideMap = (): Record<string, Function> => {
      const map: Record<string, Function> = {};
      for (const name of exportNames) {
        if (typeof (window as any)[name] === "function") {
          map[name] = (window as any)[name];
        }
      }
      return map;
    };

    const patchWebpackModules = () => {
      const overrideMap = buildOverrideMap();
      if (Object.keys(overrideMap).length === 0) return false;

      const chunk = (window as any).webpackChunk_N_E;
      if (!chunk) return false;
      let wpRequire: any;
      try {
        chunk.push([
          ["__e2e_patch_" + Date.now()],
          {},
          (req: any) => {
            wpRequire = req;
          },
        ]);
      } catch (_) {
        return false;
      }
      if (!wpRequire?.c) return false;
      let patched = false;
      Object.values(wpRequire.c).forEach((mod: any) => {
        if (
          mod?.exports &&
          typeof mod.exports === "object" &&
          mod.exports !== null
        ) {
          for (const [key, fn] of Object.entries(overrideMap)) {
            if (key in mod.exports && fn) {
              try {
                Object.defineProperty(mod.exports, key, {
                  value: fn,
                  writable: true,
                  configurable: true,
                  enumerable: true,
                });
                patched = true;
              } catch (_) {
                try {
                  mod.exports[key] = fn;
                  patched = true;
                } catch (_) {}
              }
            }
          }
        }
      });
      return patched;
    };

    let patchSucceeded = false;

    const _earlyPatchId = setInterval(() => {
      try {
        if (patchWebpackModules()) {
          patchSucceeded = true;
          clearInterval(_earlyPatchId);
        }
      } catch (_) {}
    }, 50);
    setTimeout(() => clearInterval(_earlyPatchId), 30000);

    (window as any).__applyMockBookingsOverrides = () => {
      try {
        if (patchWebpackModules()) patchSucceeded = true;
      } catch (_) {}
    };

    (window as any).__isMockPatchApplied = () => patchSucceeded;
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

      const overrideMap: Record<string, Function | undefined> = {
        clientFetchAllDataFromCollection: (window as any)
          .clientFetchAllDataFromCollection,
        getPaginatedData: (window as any).getPaginatedData,
        clientGetDataByCalendarEventId: async (
          _tableName: any,
          calendarEventId: string,
          _tenant?: string
        ) => {
          return await overrideClientGetDataById(calendarEventId);
        },
      };

      const patchWebpackModules = () => {
        const chunk = (window as any).webpackChunk_N_E;
        if (!chunk) return false;

        let wpRequire: any;
        try {
          chunk.push([
            ["__e2e_mock_" + Date.now()],
            {},
            (req: any) => {
              wpRequire = req;
            },
          ]);
        } catch (_) {
          return false;
        }

        if (!wpRequire?.c) return false;

        let patched = false;
        Object.values(wpRequire.c).forEach((mod: any) => {
          if (
            mod?.exports &&
            typeof mod.exports === "object" &&
            mod.exports !== null
          ) {
            for (const [key, fn] of Object.entries(overrideMap)) {
              if (key in mod.exports && fn) {
                try {
                  Object.defineProperty(mod.exports, key, {
                    value: fn,
                    writable: true,
                    configurable: true,
                    enumerable: true,
                  });
                  patched = true;
                } catch (_) {
                  try {
                    mod.exports[key] = fn;
                    patched = true;
                  } catch (_) {}
                }
              }
            }
          }
        });
        return patched;
      };

      let patchSucceeded = false;

      const _earlyPatchId = setInterval(() => {
        try {
          if (patchWebpackModules()) {
            patchSucceeded = true;
            clearInterval(_earlyPatchId);
          }
        } catch (_) {}
      }, 50);
      setTimeout(() => clearInterval(_earlyPatchId), 30000);

      try {
        if (patchWebpackModules()) {
          patchSucceeded = true;
        }
      } catch (_err) {
        // ignore sync errors
      }

      (window as any).__applyMockBookingsOverrides = () => {
        try {
          if (patchWebpackModules()) {
            patchSucceeded = true;
          }
        } catch (_err) {
          // ignore sync errors
        }
      };

      (window as any).__isMockPatchApplied = () => patchSucceeded;
    },
    {
      timestampFields: TIMESTAMP_FIELDS_WITH_BY,
      initialBooking: basePayload,
      initialUsersRights: rightsPayload,
      adminEmail,
    }
  );
}
