import { expect, Page, test } from "@playwright/test";

import {
  BookingOrigin,
  BookingStatusLabel,
} from "../../components/src/types";
import {
  doc,
  getDoc,
  setDoc,
  Timestamp,
} from "../../lib/firebase/stubs/firebaseFirestoreStub";
import { registerBookingMocks } from "./helpers/mock-routes";

const jsonHeaders = { "content-type": "application/json" };

const BASE_URL =
  process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";

const ADMIN_EMAIL = "test@nyu.edu";
const REQUESTOR_EMAIL = "requestor.decline@nyu.edu";

const BOOKING_DOC_ID = "mock-decline-approved-booking";
const CALENDAR_EVENT_ID = BOOKING_DOC_ID;

const USERS_RIGHTS_DOC_ID = "mock-decline-approved-rights";

const REQUEST_NUMBER = 9860;

const TIMESTAMP_FIELDS = [
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

const createTimestamp = (date: Date) => {
  const ts = new Timestamp(date);
  (ts as any).toMillis = () => date.getTime();
  (ts as any).toJSON = () => date.toISOString();
  return ts;
};

async function seedAdminUserData() {
  const now = createTimestamp(new Date());

  await setDoc(doc({} as any, "mc-usersRights", USERS_RIGHTS_DOC_ID), {
    email: ADMIN_EMAIL,
    isAdmin: true,
    isWorker: false,
    isLiaison: false,
    isEquipment: false,
    isStaffing: false,
    isSetup: false,
    isCatering: false,
    isCleaning: false,
    isSecurity: false,
    createdAt: now,
    updatedAt: now,
  });
}

async function seedApprovedBooking() {
  const now = new Date();
  const startDate = new Date(now.getTime() + 60 * 60 * 1000);
  const endDate = new Date(startDate.getTime() + 60 * 60 * 1000);
  const zeroTimestamp = createTimestamp(new Date(0));

  await setDoc(doc({} as any, "mc-bookings", BOOKING_DOC_ID), {
    calendarEventId: CALENDAR_EVENT_ID,
    requestNumber: REQUEST_NUMBER,
    email: REQUESTOR_EMAIL,
    firstName: "Decline",
    lastName: "Requester",
    secondaryName: "",
    nNumber: "N44556677",
    netId: "declinereq",
    phoneNumber: "555-333-4444",
    department: "ITP",
    otherDepartment: "",
    role: "Student",
    sponsorFirstName: "Faculty",
    sponsorLastName: "Member",
    sponsorEmail: "faculty.member@nyu.edu",
    title: "Decline Approved Test Booking",
    description: "Booking seeded for decline from approved state test.",
    bookingType: "Workshop",
    attendeeAffiliation: "NYU Members with an active NYU ID",
    roomSetup: "No",
    setupDetails: "",
    mediaServices: "",
    mediaServicesDetails: "",
    equipmentServices: "",
    equipmentServicesDetails: "",
    staffingServices: "",
    staffingServicesDetails: "",
    catering: "no",
    cateringService: "",
    cleaningService: "",
    hireSecurity: "no",
    expectedAttendance: "20",
    chartFieldForCatering: "",
    chartFieldForCleaning: "",
    chartFieldForSecurity: "",
    chartFieldForRoomSetup: "",
    devBranch: "development",
    missingEmail: "",
    startDate: createTimestamp(startDate),
    endDate: createTimestamp(endDate),
    requestedAt: createTimestamp(now),
    firstApprovedAt: createTimestamp(now),
    firstApprovedBy: "liaison@nyu.edu",
    finalApprovedAt: createTimestamp(now),
    finalApprovedBy: "admin@nyu.edu",
    declinedAt: zeroTimestamp,
    declinedBy: "",
    declineReason: "",
    canceledAt: zeroTimestamp,
    canceledBy: "",
    checkedInAt: zeroTimestamp,
    checkedInBy: "",
    checkedOutAt: zeroTimestamp,
    checkedOutBy: "",
    noShowedAt: zeroTimestamp,
    noShowedBy: "",
    closedAt: zeroTimestamp,
    closedBy: "",
    walkedInAt: zeroTimestamp,
    origin: BookingOrigin.USER,
    status: BookingStatusLabel.APPROVED,
    equipmentCheckedOut: false,
    roomId: "202",
    selectedRooms: [
      {
        roomId: 202,
        name: "Media Commons Room 202",
        calendarId: "mock-calendar-202",
        shouldAutoApprove: false,
        isEquipment: false,
      },
    ],
    departmentTier: "Tier 1",
    xstateData: {
      machineId: "mc-booking-machine-v5",
      lastTransition: "Approved",
      snapshot: {
        value: "Approved",
        status: BookingStatusLabel.APPROVED,
        context: {
          status: BookingStatusLabel.APPROVED,
          calendarEventId: CALENDAR_EVENT_ID,
          servicesRequested: {},
          servicesApproved: {},
        },
      },
    },
  });
}

function serializeBookingRecord(record: any) {
  const serialized: Record<string, any> = { ...record };

  for (const field of TIMESTAMP_FIELDS) {
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

function serializeGenericRecord(record: any) {
  const serialized: Record<string, any> = { ...record };

  Object.entries(serialized).forEach(([key, value]) => {
    if (value && typeof (value as any).toDate === "function") {
      serialized[key] = (value as any).toDate().toISOString();
    }
  });

  return serialized;
}

async function registerMockBookingsFeed(page: Page) {
  const snapshot = await getDoc(
    doc({} as any, "mc-bookings", BOOKING_DOC_ID)
  );
  const baseData = snapshot.data();
  const basePayload = baseData
    ? {
        id: BOOKING_DOC_ID,
        calendarEventId: CALENDAR_EVENT_ID,
        ...serializeBookingRecord(baseData),
      }
    : null;

  const rightsSnapshot = await getDoc(
    doc({} as any, "mc-usersRights", USERS_RIGHTS_DOC_ID)
  );
  const rightsPayload = rightsSnapshot.data()
    ? {
        id: USERS_RIGHTS_DOC_ID,
        ...serializeGenericRecord(rightsSnapshot.data()),
      }
    : null;

  await page.route("**/api/__mock__/bookings", async (route) => {
    const latestSnapshot = await getDoc(
      doc({} as any, "mc-bookings", BOOKING_DOC_ID)
    );
    const latestData = latestSnapshot.data();
    const payload = latestData
      ? [
          {
            id: BOOKING_DOC_ID,
            calendarEventId: CALENDAR_EVENT_ID,
            ...serializeBookingRecord(latestData),
          },
        ]
      : [];

    await route.fulfill({
      status: 200,
      headers: jsonHeaders,
      body: JSON.stringify(payload),
    });
  });

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
          !normalizedTableName.includes("type")
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
          !path.includes("bookingTypes")
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

      if (initialBooking) {
        (window as any).__mockBookings = [enrichBooking(initialBooking)];
      }

      (window as any).__bookingE2EMocks = {
        bookings: (window as any).__mockBookings,
        usersRights: usersRightsRecords,
        usersApprovers: [],
      };

      const syncWebpackExports = () => {
        const webpackRequire = (window as any).__webpack_require__;
        const modules = webpackRequire?.c;
        if (!modules) {
          return;
        }
        Object.values(modules).forEach((mod: any) => {
          if (mod?.exports) {
            if ("clientFetchAllDataFromCollection" in mod.exports) {
              mod.exports.clientFetchAllDataFromCollection =
                (window as any).clientFetchAllDataFromCollection;
            }
            if ("getPaginatedData" in mod.exports) {
              mod.exports.getPaginatedData =
                (window as any).getPaginatedData;
            }
            if ("clientGetDataByCalendarEventId" in mod.exports) {
              mod.exports.clientGetDataByCalendarEventId = async (
                _tableName: any,
                calendarEventId: string,
                tenant?: string
              ) => {
                const bookings = await ensureBookings();
                const match = bookings.find(
                  (booking: any) =>
                    booking.calendarEventId === calendarEventId
                );
                if (!match) return null;
                return {
                  id: match.id ?? match.calendarEventId,
                  ...match,
                };
              };
            }
          }
        });
      };

      if (!(window as any).__mockBookingsWebpackPatched) {
        const webpackRequire = (window as any).__webpack_require__;
        if (webpackRequire) {
          const originalWebpackRequire = webpackRequire;
          const patchedWebpackRequire = function () {
            const result = originalWebpackRequire.apply(this, arguments);
            try {
              syncWebpackExports();
            } catch (_err) {
              // ignore sync errors
            }
            return result;
          };
          patchedWebpackRequire.m = originalWebpackRequire.m;
          patchedWebpackRequire.c = originalWebpackRequire.c;
          (window as any).__webpack_require__ = patchedWebpackRequire;
          (window as any).__mockBookingsWebpackPatched = true;
        }
      }

      try {
        syncWebpackExports();
      } catch (_err) {
        // ignore sync errors
      }

      (window as any).__applyMockBookingsOverrides = () => {
        try {
          syncWebpackExports();
        } catch (_err) {
          // ignore sync errors
        }
      };
    },
    {
      timestampFields: TIMESTAMP_FIELDS,
      initialBooking: basePayload,
      initialUsersRights: rightsPayload,
      adminEmail: ADMIN_EMAIL,
    }
  );
}

async function mockTransitionEndpoints(page: Page) {
  await page.route("**/api/xstate-transition", async (route) => {
    if (route.request().method() === "POST") {
      const body = route.request().postDataJSON();
      const eventType = body?.eventType;

      let newState = "Unknown";
      if (eventType === "decline") newState = "Declined";
      else if (eventType === "cancel") newState = "Canceled";

      await route.fulfill({
        status: 200,
        headers: jsonHeaders,
        body: JSON.stringify({
          success: true,
          newState,
        }),
      });
      return;
    }
    await route.fulfill({
      status: 405,
      headers: jsonHeaders,
      body: JSON.stringify({ error: "Method Not Allowed" }),
    });
  });

  await page.route("**/api/booking-logs**", async (route) => {
    if (route.request().method() === "POST") {
      await route.fulfill({
        status: 200,
        headers: jsonHeaders,
        body: JSON.stringify({ success: true }),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      headers: jsonHeaders,
      body: JSON.stringify([]),
    });
  });
}

test.describe("Decline from Approved state (mocked Firestore)", () => {
  test.beforeEach(async ({ page }) => {
    await registerBookingMocks(page);

    await seedAdminUserData();
    await seedApprovedBooking();
    await registerMockBookingsFeed(page);

    await mockTransitionEndpoints(page);
  });

  test("Admin can decline an APPROVED booking", async ({ page }) => {
    await page.goto(`${BASE_URL}/mc/admin`, {
      waitUntil: "domcontentloaded",
    });
    await page.waitForLoadState("networkidle");
    await page.waitForFunction(
      () =>
        typeof (window as any).__applyMockBookingsOverrides === "function"
    );
    await page.evaluate(() => {
      if (
        typeof (window as any).__applyMockBookingsOverrides === "function"
      ) {
        (window as any).__applyMockBookingsOverrides();
      }
    });

    const bookingRow = page
      .locator('[role="row"]')
      .filter({ hasText: "Decline Approved Test Booking" })
      .first();
    await bookingRow.waitFor({ state: "visible", timeout: 15_000 });

    // Set up request interception AFTER page load, before triggering action
    const declineRequestPromise = page.waitForRequest(
      (request) =>
        request.url().includes("/api/xstate-transition") &&
        request.method() === "POST"
    );
    const declineResponsePromise = page.waitForResponse(
      (response) =>
        response.url().includes("/api/xstate-transition") &&
        response.request().method() === "POST"
    );

    await bookingRow.locator('[role="combobox"]').click();
    await page.getByRole("option", { name: "Decline" }).click();

    const confirmButton = bookingRow.locator(
      'button:has(svg[data-testid="CheckIcon"])'
    );
    await confirmButton.waitFor({ state: "visible", timeout: 5_000 });
    await confirmButton.click();

    const declineDialog = page.getByRole("dialog");
    const declineReason = "Admin cannot accommodate";
    await declineDialog.getByRole("textbox").fill(declineReason);
    await declineDialog.getByRole("button", { name: "Ok" }).click();

    const declineRequest = await declineRequestPromise;
    await declineResponsePromise;

    const declinePayload = declineRequest.postDataJSON() ?? {};
    expect(declinePayload).toMatchObject({
      calendarEventId: CALENDAR_EVENT_ID,
      eventType: "decline",
      email: ADMIN_EMAIL,
      reason: declineReason,
    });
  });
});
