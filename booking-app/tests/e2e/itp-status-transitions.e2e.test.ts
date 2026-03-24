import { expect, Page, test } from "@playwright/test";

import {
  BookingOrigin,
  BookingStatusLabel,
} from "../../components/src/types";
import {
  doc,
  getDoc,
  setDoc,
} from "../../lib/firebase/stubs/firebaseFirestoreStub";
import { registerItpBookingMocks } from "./helpers/itp-mock-routes";
import { applyMockOverrides } from "./helpers/test-utils";
import {
  createTimestamp,
  serializeBookingRecord,
  serializeGenericRecord,
  TIMESTAMP_FIELDS_WITH_BY,
  registerDefinePropertyInterceptor,
} from "./helpers/xstate-mocks";

const jsonHeaders = { "content-type": "application/json" };

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";

const ADMIN_EMAIL = "test@nyu.edu";

const BOOKING_DOC_ID = "mock-itp-status-booking";
const CALENDAR_EVENT_ID = BOOKING_DOC_ID;

const USERS_RIGHTS_DOC_ID = "mock-itp-status-rights";

const REQUEST_NUMBER = 20200;

async function seedItpAdminUserData() {
  const now = createTimestamp(new Date());

  await setDoc(doc({} as any, "itp-usersRights", USERS_RIGHTS_DOC_ID), {
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

async function seedItpBooking(opts: {
  status: BookingStatusLabel;
  xstateValue: string;
  startDate: Date;
  endDate: Date;
  checkedInAt?: Date;
}) {
  const now = new Date();
  const zeroTimestamp = createTimestamp(new Date(0));

  await setDoc(doc({} as any, "itp-bookings", BOOKING_DOC_ID), {
    calendarEventId: CALENDAR_EVENT_ID,
    requestNumber: REQUEST_NUMBER,
    email: "itpstudent@nyu.edu",
    firstName: "ITP",
    lastName: "Student",
    secondaryName: "",
    nNumber: "",
    netId: "itpstu",
    phoneNumber: "555-111-2222",
    department: "ITP / IMA / Low Res",
    otherDepartment: "",
    role: "Student",
    sponsorFirstName: "",
    sponsorLastName: "",
    sponsorEmail: "",
    title: "ITP Status Transition Test",
    description: "Booking seeded for ITP status transition tests.",
    bookingType: "",
    attendeeAffiliation: "NYU Members with an active NYU ID",
    roomSetup: "",
    setupDetails: "",
    mediaServices: "",
    mediaServicesDetails: "",
    equipmentServices: "",
    equipmentServicesDetails: "",
    staffingServices: "",
    staffingServicesDetails: "",
    catering: "",
    cateringService: "",
    cleaningService: "",
    hireSecurity: "",
    expectedAttendance: "5",
    chartFieldForCatering: "",
    chartFieldForCleaning: "",
    chartFieldForSecurity: "",
    chartFieldForRoomSetup: "",
    devBranch: "development",
    missingEmail: "",
    startDate: createTimestamp(opts.startDate),
    endDate: createTimestamp(opts.endDate),
    requestedAt: createTimestamp(now),
    firstApprovedAt: createTimestamp(now),
    firstApprovedBy: "itpadmin@nyu.edu",
    finalApprovedAt: createTimestamp(now),
    finalApprovedBy: "itpadmin@nyu.edu",
    declinedAt: zeroTimestamp,
    declinedBy: "",
    declineReason: "",
    canceledAt: zeroTimestamp,
    canceledBy: "",
    checkedInAt: opts.checkedInAt
      ? createTimestamp(opts.checkedInAt)
      : zeroTimestamp,
    checkedInBy: opts.checkedInAt ? ADMIN_EMAIL : "",
    checkedOutAt: zeroTimestamp,
    checkedOutBy: "",
    noShowedAt: zeroTimestamp,
    noShowedBy: "",
    closedAt: zeroTimestamp,
    closedBy: "",
    walkedInAt: zeroTimestamp,
    origin: BookingOrigin.USER,
    status: opts.status,
    equipmentCheckedOut: false,
    roomId: "408",
    selectedRooms: [
      {
        roomId: 408,
        name: "Room 408",
        calendarId: "mock-calendar-408",
        shouldAutoApprove: true,
        isEquipment: false,
      },
    ],
    departmentTier: "Tier 1",
    tenant: "itp",
    xstateData: {
      machineId: "itp-booking-machine-v5",
      lastTransition: opts.xstateValue,
      snapshot: {
        value: opts.xstateValue,
        status: opts.status,
        context: {
          status: opts.status,
          calendarEventId: CALENDAR_EVENT_ID,
          servicesRequested: {},
          servicesApproved: {},
        },
      },
    },
  });
}

async function registerItpMockBookingsFeed(page: Page) {
  const rightsSnapshot = await getDoc(
    doc({} as any, "itp-usersRights", USERS_RIGHTS_DOC_ID),
  );
  const rightsPayload = rightsSnapshot.data()
    ? {
        id: USERS_RIGHTS_DOC_ID,
        ...serializeGenericRecord(rightsSnapshot.data()),
      }
    : null;

  await page.route("**/api/__mock__/bookings", async (route) => {
    const latestSnapshot = await getDoc(
      doc({} as any, "itp-bookings", BOOKING_DOC_ID),
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

  await registerDefinePropertyInterceptor(page);

  await page.addInitScript(
    ({
      timestampFields,
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
            },
          ),
          usersApprovers: [
            {
              email: adminEmail,
              department: "ITP",
              level: 3,
              createdAt: new Date().toISOString(),
            },
          ],
          safetyTrainedUsers: [],
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
        tenant: string,
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
        tenant?: string,
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
              }),
            ),
          };
        }

        if (path && path.includes("usersApprovers")) {
          return { docs: [] };
        }

        if (originalGetDocs) {
          return await originalGetDocs(queryRef);
        }

        return { docs: [] };
      };

      void loadBookings().catch(() => {});

      const overrideClientGetDataById = async (
        calendarEventId: string,
      ) => {
        const bookings = await ensureBookings();
        const match = bookings.find(
          (booking: any) => booking.calendarEventId === calendarEventId,
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
          _tenant?: string,
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
            ["__e2e_itp_mock_" + Date.now()],
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
      } catch (_err) {}

      (window as any).__applyMockBookingsOverrides = () => {
        try {
          if (patchWebpackModules()) {
            patchSucceeded = true;
          }
        } catch (_err) {}
      };

      (window as any).__isMockPatchApplied = () => patchSucceeded;
    },
    {
      timestampFields: TIMESTAMP_FIELDS_WITH_BY,
      initialUsersRights: rightsPayload,
      adminEmail: ADMIN_EMAIL,
    },
  );
}

async function mockItpTransitionEndpoints(page: Page) {
  await page.route("**/api/xstate-transition", async (route) => {
    if (route.request().method() === "POST") {
      const body = route.request().postDataJSON();
      const eventType = body?.eventType;

      let newState = "Unknown";
      if (eventType === "checkIn") newState = "Checked In";
      else if (eventType === "checkOut") newState = "Checked Out";
      else if (eventType === "noShow") newState = "No Show";
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

/**
 * Navigate to ITP admin page, apply mock overrides, and wait for the booking row.
 * Returns { bookingRow, transitionRequestPromise, transitionResponsePromise }.
 */
async function navigateToItpAdminAndWaitForRow(page: Page) {
  const transitionRequestPromise = page.waitForRequest(
    (request) =>
      request.url().includes("/api/xstate-transition") &&
      request.method() === "POST",
  );
  const transitionResponsePromise = page.waitForResponse(
    (response) =>
      response.url().includes("/api/xstate-transition") &&
      response.request().method() === "POST",
  );

  await page.goto(`${BASE_URL}/itp/admin`, {
    waitUntil: "domcontentloaded",
  });
  await page.waitForLoadState("networkidle");
  await applyMockOverrides(page);

  const bookingRow = page
    .locator('[role="row"]')
    .filter({ hasText: "ITP Status Transition Test" })
    .first();
  await bookingRow.waitFor({ state: "visible", timeout: 15_000 });

  return { bookingRow, transitionRequestPromise, transitionResponsePromise };
}

/**
 * Select a status action from the combobox, confirm, and assert the transition payload.
 */
async function selectActionAndAssert(
  page: Page,
  bookingRow: ReturnType<Page["locator"]>,
  actionName: string,
  expectedEventType: string,
  transitionRequestPromise: Promise<any>,
  transitionResponsePromise: Promise<any>,
  opts: { hasDialog?: boolean } = {},
) {
  await bookingRow.locator('[role="combobox"]').click();
  await page.getByRole("option", { name: actionName }).click();

  const confirmButton = bookingRow.locator(
    'button:has(svg[data-testid="CheckIcon"])',
  );
  await confirmButton.waitFor({ state: "visible", timeout: 5_000 });
  await confirmButton.click();

  if (opts.hasDialog) {
    const cancelDialog = page.getByRole("dialog");
    await cancelDialog.getByRole("button", { name: "Ok" }).click();
  }

  const transitionRequest = await transitionRequestPromise;
  await transitionResponsePromise;

  const payload = transitionRequest.postDataJSON() ?? {};
  expect(payload).toMatchObject({
    calendarEventId: CALENDAR_EVENT_ID,
    eventType: expectedEventType,
  });
}

test.describe("ITP Status Transitions", () => {
  test("Admin can check-in an APPROVED ITP booking", async ({ page }) => {
    await registerItpBookingMocks(page);
    await seedItpAdminUserData();

    const now = new Date();
    const startDate = new Date(now.getTime() - 10 * 60 * 1000);
    const endDate = new Date(startDate.getTime() + 60 * 60 * 1000);

    await seedItpBooking({
      status: BookingStatusLabel.APPROVED,
      xstateValue: "Approved",
      startDate,
      endDate,
    });

    await registerItpMockBookingsFeed(page);
    await mockItpTransitionEndpoints(page);

    const { bookingRow, transitionRequestPromise, transitionResponsePromise } =
      await navigateToItpAdminAndWaitForRow(page);

    await selectActionAndAssert(
      page, bookingRow, "Check In", "checkIn",
      transitionRequestPromise, transitionResponsePromise,
    );
  });

  test("Admin can check-out a CHECKED_IN ITP booking", async ({ page }) => {
    await registerItpBookingMocks(page);
    await seedItpAdminUserData();

    const now = new Date();
    const startDate = new Date(now.getTime() - 30 * 60 * 1000);
    const endDate = new Date(startDate.getTime() + 60 * 60 * 1000);
    const checkedInAt = new Date(now.getTime() - 20 * 60 * 1000);

    await seedItpBooking({
      status: BookingStatusLabel.CHECKED_IN,
      xstateValue: "Checked In",
      startDate,
      endDate,
      checkedInAt,
    });

    await registerItpMockBookingsFeed(page);
    await mockItpTransitionEndpoints(page);

    const { bookingRow, transitionRequestPromise, transitionResponsePromise } =
      await navigateToItpAdminAndWaitForRow(page);

    await selectActionAndAssert(
      page, bookingRow, "Check Out", "checkOut",
      transitionRequestPromise, transitionResponsePromise,
    );
  });

  test("Admin can mark no-show for APPROVED ITP booking 30+ minutes past start", async ({
    page,
  }) => {
    await registerItpBookingMocks(page);
    await seedItpAdminUserData();

    const now = new Date();
    const startDate = new Date(now.getTime() - 40 * 60 * 1000);
    const endDate = new Date(startDate.getTime() + 60 * 60 * 1000);

    await seedItpBooking({
      status: BookingStatusLabel.APPROVED,
      xstateValue: "Approved",
      startDate,
      endDate,
    });

    await registerItpMockBookingsFeed(page);
    await mockItpTransitionEndpoints(page);

    const { bookingRow, transitionRequestPromise, transitionResponsePromise } =
      await navigateToItpAdminAndWaitForRow(page);

    await selectActionAndAssert(
      page, bookingRow, "No Show", "noShow",
      transitionRequestPromise, transitionResponsePromise,
    );
  });

  test("Admin can cancel an APPROVED ITP booking", async ({ page }) => {
    await registerItpBookingMocks(page);
    await seedItpAdminUserData();

    const now = new Date();
    const startDate = new Date(now.getTime() + 60 * 60 * 1000);
    const endDate = new Date(startDate.getTime() + 60 * 60 * 1000);

    await seedItpBooking({
      status: BookingStatusLabel.APPROVED,
      xstateValue: "Approved",
      startDate,
      endDate,
    });

    await registerItpMockBookingsFeed(page);
    await mockItpTransitionEndpoints(page);

    const { bookingRow, transitionRequestPromise, transitionResponsePromise } =
      await navigateToItpAdminAndWaitForRow(page);

    await selectActionAndAssert(
      page, bookingRow, "Cancel", "cancel",
      transitionRequestPromise, transitionResponsePromise,
      { hasDialog: true },
    );
  });
});
