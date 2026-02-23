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
const REQUESTOR_EMAIL = "requestor.lifecycle@nyu.edu";

const BOOKING_DOC_ID = "mock-lifecycle-booking";
const CALENDAR_EVENT_ID = BOOKING_DOC_ID;

const USERS_RIGHTS_DOC_ID = "mock-lifecycle-rights";

const REQUEST_NUMBER = 9900;

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
    isWorker: true,
    isLiaison: true,
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

async function seedRequestedBooking() {
  const now = new Date();
  const startDate = new Date(now.getTime() + 60 * 60 * 1000);
  const endDate = new Date(startDate.getTime() + 60 * 60 * 1000);
  const zeroTimestamp = createTimestamp(new Date(0));

  await setDoc(doc({} as any, "mc-bookings", BOOKING_DOC_ID), {
    calendarEventId: CALENDAR_EVENT_ID,
    requestNumber: REQUEST_NUMBER,
    email: REQUESTOR_EMAIL,
    firstName: "Lifecycle",
    lastName: "Requester",
    secondaryName: "",
    nNumber: "N44556677",
    netId: "lifecyclereq",
    phoneNumber: "555-333-4444",
    department: "ITP",
    otherDepartment: "",
    role: "Student",
    sponsorFirstName: "Faculty",
    sponsorLastName: "Member",
    sponsorEmail: "faculty.member@nyu.edu",
    title: "Lifecycle Test Booking",
    description: "Booking seeded for full lifecycle test.",
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
    firstApprovedAt: zeroTimestamp,
    firstApprovedBy: "",
    finalApprovedAt: zeroTimestamp,
    finalApprovedBy: "",
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
    status: BookingStatusLabel.REQUESTED,
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
      lastTransition: null,
      snapshot: {
        value: "Requested",
        status: BookingStatusLabel.REQUESTED,
        context: {
          status: BookingStatusLabel.REQUESTED,
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

  // Intercept Object.defineProperty to force configurable: true on target exports
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
        return await loadBookings();
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

      const e2eMocks: Record<string, any> = {
        usersRights: usersRightsRecords,
        usersApprovers: [],
      };
      Object.defineProperty(e2eMocks, "bookings", {
        get: () => (window as any).__mockBookings ?? [],
        enumerable: true,
        configurable: true,
      });
      (window as any).__bookingE2EMocks = e2eMocks;

      const overrideMap: Record<string, Function | null> = {
        clientFetchAllDataFromCollection:
          (window as any).clientFetchAllDataFromCollection,
        getPaginatedData: (window as any).getPaginatedData,
        clientGetDataByCalendarEventId: async (
          _tableName: any,
          calendarEventId: string,
          _tenant?: string
        ) => {
          const bookings = await ensureBookings();
          const match = bookings.find(
            (booking: any) => booking.calendarEventId === calendarEventId
          );
          if (!match) return null;
          return {
            id: match.id ?? match.calendarEventId,
            ...match,
          };
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

      // Early patching interval
      const _earlyPatchId = setInterval(() => {
        try {
          if (patchWebpackModules()) clearInterval(_earlyPatchId);
        } catch (_) {}
      }, 2);
      setTimeout(() => clearInterval(_earlyPatchId), 10000);

      (window as any).__applyMockBookingsOverrides = () => {
        try {
          patchWebpackModules();
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

async function mockLifecycleEndpoints(page: Page) {
  let approveCallCount = 0;

  await page.route("**/api/approve", async (route) => {
    if (route.request().method() !== "POST") {
      await route.fulfill({
        status: 405,
        headers: jsonHeaders,
        body: JSON.stringify({ error: "Method Not Allowed" }),
      });
      return;
    }

    approveCallCount++;
    const body = route.request().postDataJSON();
    const email = body?.email ?? ADMIN_EMAIL;
    const approvedAt = createTimestamp(new Date());

    const bookingRef = doc({} as any, "mc-bookings", BOOKING_DOC_ID);
    const bookingSnapshot = await getDoc(bookingRef);
    const bookingData = bookingSnapshot.data() ?? {};

    if (approveCallCount === 1) {
      // 1st Approve → PRE_APPROVED
      const updatedBooking = {
        ...bookingData,
        status: BookingStatusLabel.PRE_APPROVED,
        firstApprovedAt: approvedAt,
        firstApprovedBy: email,
        xstateData: {
          ...(bookingData?.xstateData ?? {}),
          lastTransition: "Pre-approved",
          snapshot: {
            ...(bookingData?.xstateData?.snapshot ?? {}),
            value: "Pre-approved",
            status: BookingStatusLabel.PRE_APPROVED,
            context: {
              ...(bookingData?.xstateData?.snapshot?.context ?? {}),
              status: BookingStatusLabel.PRE_APPROVED,
              calendarEventId: CALENDAR_EVENT_ID,
              lastApprovedBy: email,
            },
          },
        },
      };
      await setDoc(bookingRef, updatedBooking);
    } else {
      // 2nd Approve → APPROVED
      const updatedBooking = {
        ...bookingData,
        status: BookingStatusLabel.APPROVED,
        finalApprovedAt: approvedAt,
        finalApprovedBy: email,
        xstateData: {
          ...(bookingData?.xstateData ?? {}),
          lastTransition: "Approved",
          snapshot: {
            ...(bookingData?.xstateData?.snapshot ?? {}),
            value: "Approved",
            status: BookingStatusLabel.APPROVED,
            context: {
              ...(bookingData?.xstateData?.snapshot?.context ?? {}),
              status: BookingStatusLabel.APPROVED,
              calendarEventId: CALENDAR_EVENT_ID,
              lastApprovedBy: email,
            },
          },
        },
      };
      await setDoc(bookingRef, updatedBooking);
    }

    await route.fulfill({
      status: 200,
      headers: jsonHeaders,
      body: JSON.stringify({ message: "Approved successfully" }),
    });
  });

  await page.route("**/api/xstate-transition", async (route) => {
    if (route.request().method() !== "POST") {
      await route.fulfill({
        status: 405,
        headers: jsonHeaders,
        body: JSON.stringify({ error: "Method Not Allowed" }),
      });
      return;
    }

    const body = route.request().postDataJSON();
    const eventType = body?.eventType;
    const email = body?.email ?? ADMIN_EMAIL;

    const bookingRef = doc({} as any, "mc-bookings", BOOKING_DOC_ID);
    const bookingSnapshot = await getDoc(bookingRef);
    const bookingData = bookingSnapshot.data() ?? {};

    let newStatus: BookingStatusLabel;
    let newXstateValue: string;

    if (eventType === "checkIn") {
      newStatus = BookingStatusLabel.CHECKED_IN;
      newXstateValue = "Checked In";
    } else if (eventType === "checkOut") {
      newStatus = BookingStatusLabel.CHECKED_OUT;
      newXstateValue = "Checked Out";
    } else {
      await route.fulfill({
        status: 200,
        headers: jsonHeaders,
        body: JSON.stringify({ success: true }),
      });
      return;
    }

    const updatedBooking = {
      ...bookingData,
      status: newStatus,
      ...(eventType === "checkIn"
        ? {
            checkedInAt: createTimestamp(new Date()),
            checkedInBy: email,
          }
        : {}),
      ...(eventType === "checkOut"
        ? {
            checkedOutAt: createTimestamp(new Date()),
            checkedOutBy: email,
          }
        : {}),
      xstateData: {
        ...(bookingData?.xstateData ?? {}),
        lastTransition: newXstateValue,
        snapshot: {
          ...(bookingData?.xstateData?.snapshot ?? {}),
          value: newXstateValue,
          status: newStatus,
          context: {
            ...(bookingData?.xstateData?.snapshot?.context ?? {}),
            status: newStatus,
            calendarEventId: CALENDAR_EVENT_ID,
          },
        },
      },
    };
    await setDoc(bookingRef, updatedBooking);

    await route.fulfill({
      status: 200,
      headers: jsonHeaders,
      body: JSON.stringify({ success: true, newState: newXstateValue }),
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

async function navigateAndWait(page: Page) {
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
}

async function refreshBookingsAndReload(page: Page) {
  // Reload the page
  await page.goto(`${BASE_URL}/mc/admin`, {
    waitUntil: "domcontentloaded",
  });
  await page.waitForLoadState("networkidle");
  await page.waitForFunction(
    () =>
      typeof (window as any).__applyMockBookingsOverrides === "function"
  );

  // Refresh mock bookings from the updated Firestore stub
  await page.evaluate(async () => {
    if (typeof (window as any).__refreshMockBookings === "function") {
      await (window as any).__refreshMockBookings();
    }
    if (typeof (window as any).__applyMockBookingsOverrides === "function") {
      (window as any).__applyMockBookingsOverrides();
    }
  });

  // Toggle date range filter to trigger component re-fetch with fresh data.
  // The date range combobox is the one NOT inside the header bar (not the role selector).
  // Use the combobox that currently shows "All Future".
  const dateCombobox = page.locator('[role="combobox"]').filter({ hasText: /All Future|This Week/ }).first();
  await dateCombobox.click();
  await page.getByRole("option", { name: "This Week" }).click();
  await page.waitForTimeout(300);
  await dateCombobox.click();
  await page.getByRole("option", { name: "All Future" }).click();
  await page.waitForTimeout(500);
}

test.describe("Full MC lifecycle (mocked Firestore)", () => {
  test("Full MC lifecycle: Requested → Approved → Checked Out", async ({
    page,
  }) => {
    await registerBookingMocks(page);

    await seedAdminUserData();
    await seedRequestedBooking();
    await registerMockBookingsFeed(page);
    await mockLifecycleEndpoints(page);

    // Step 1: Navigate to admin page and find booking
    await navigateAndWait(page);

    const bookingRow = page
      .locator('[role="row"]')
      .filter({ hasText: "Lifecycle Test Booking" })
      .first();
    await bookingRow.waitFor({ state: "visible", timeout: 15_000 });

    // Step 2: 1st Approve → PRE_APPROVED
    let approveRequestPromise = page.waitForRequest(
      (request) =>
        request.url().includes("/api/approve") &&
        request.method() === "POST"
    );
    let approveResponsePromise = page.waitForResponse(
      (response) =>
        response.url().includes("/api/approve") &&
        response.request().method() === "POST"
    );

    await bookingRow.locator('[role="combobox"]').click();
    await page.getByRole("option", { name: "1st Approve" }).click();

    let confirmButton = bookingRow.locator(
      'button:has(svg[data-testid="CheckIcon"])'
    );
    await confirmButton.waitFor({ state: "visible", timeout: 5_000 });
    await confirmButton.click();

    await approveRequestPromise;
    await approveResponsePromise;

    // Step 3: Reload and verify PRE-APPROVED
    await refreshBookingsAndReload(page);

    const preApprovedRow = page
      .locator('[role="row"]')
      .filter({ hasText: "Lifecycle Test Booking" })
      .first();
    await preApprovedRow.waitFor({ state: "visible", timeout: 15_000 });
    await expect(preApprovedRow).toContainText("Pre-Approved");

    // Step 4: 2nd Approve → APPROVED
    approveRequestPromise = page.waitForRequest(
      (request) =>
        request.url().includes("/api/approve") &&
        request.method() === "POST"
    );
    approveResponsePromise = page.waitForResponse(
      (response) =>
        response.url().includes("/api/approve") &&
        response.request().method() === "POST"
    );

    await preApprovedRow.locator('[role="combobox"]').click();
    await page.getByRole("option", { name: "2nd Approve" }).click();

    confirmButton = preApprovedRow.locator(
      'button:has(svg[data-testid="CheckIcon"])'
    );
    await confirmButton.waitFor({ state: "visible", timeout: 5_000 });
    await confirmButton.click();

    await approveRequestPromise;
    await approveResponsePromise;

    // Step 5: Reload and verify APPROVED
    await refreshBookingsAndReload(page);

    const approvedRow = page
      .locator('[role="row"]')
      .filter({ hasText: "Lifecycle Test Booking" })
      .first();
    await approvedRow.waitFor({ state: "visible", timeout: 15_000 });
    await expect(approvedRow).toContainText("Approved");

    // Step 6: Check In → CHECKED_IN
    let transitionRequestPromise = page.waitForRequest(
      (request) =>
        request.url().includes("/api/xstate-transition") &&
        request.method() === "POST"
    );
    let transitionResponsePromise = page.waitForResponse(
      (response) =>
        response.url().includes("/api/xstate-transition") &&
        response.request().method() === "POST"
    );

    await approvedRow.locator('[role="combobox"]').click();
    await page.getByRole("option", { name: "Check In" }).click();

    confirmButton = approvedRow.locator(
      'button:has(svg[data-testid="CheckIcon"])'
    );
    await confirmButton.waitFor({ state: "visible", timeout: 5_000 });
    await confirmButton.click();

    await transitionRequestPromise;
    await transitionResponsePromise;

    // Step 7: Reload and verify CHECKED-IN
    await refreshBookingsAndReload(page);

    const checkedInRow = page
      .locator('[role="row"]')
      .filter({ hasText: "Lifecycle Test Booking" })
      .first();
    await checkedInRow.waitFor({ state: "visible", timeout: 15_000 });
    await expect(checkedInRow).toContainText("Checked In");

    // Step 8: Check Out → CHECKED_OUT
    transitionRequestPromise = page.waitForRequest(
      (request) =>
        request.url().includes("/api/xstate-transition") &&
        request.method() === "POST"
    );
    transitionResponsePromise = page.waitForResponse(
      (response) =>
        response.url().includes("/api/xstate-transition") &&
        response.request().method() === "POST"
    );

    await checkedInRow.locator('[role="combobox"]').click();
    await page.getByRole("option", { name: "Check Out" }).click();

    confirmButton = checkedInRow.locator(
      'button:has(svg[data-testid="CheckIcon"])'
    );
    await confirmButton.waitFor({ state: "visible", timeout: 5_000 });
    await confirmButton.click();

    await transitionRequestPromise;
    await transitionResponsePromise;

    // Step 9: Verify CHECKED-OUT
    await refreshBookingsAndReload(page);

    const checkedOutRow = page
      .locator('[role="row"]')
      .filter({ hasText: "Lifecycle Test Booking" })
      .first();
    await checkedOutRow.waitFor({ state: "visible", timeout: 15_000 });
    await expect(checkedOutRow).toContainText("Checked Out");
  });
});
