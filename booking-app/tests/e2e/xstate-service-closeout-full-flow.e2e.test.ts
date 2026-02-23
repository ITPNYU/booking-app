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
import { registerBookingMocks } from "./helpers/mock-routes";
import {
  JSON_HEADERS,
  TIMESTAMP_FIELDS_WITH_BY,
  createTimestamp,
  serializeBookingRecord,
  serializeGenericRecord,
  registerDefinePropertyInterceptor,
} from "./helpers/xstate-mocks";

const BASE_URL =
  process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";

const ADMIN_EMAIL = "test@nyu.edu";
const REQUESTOR_EMAIL = "requestor.closeout-full@nyu.edu";

const BOOKING_DOC_ID = "mock-closeout-full-flow-booking";
const CALENDAR_EVENT_ID = BOOKING_DOC_ID;

const USERS_RIGHTS_DOC_ID = "mock-closeout-full-flow-rights";
const USERS_APPROVER_DOC_ID = "mock-closeout-full-flow-approver";

const REQUEST_NUMBER = 9920;

const SERVICE_METADATA = {
  staff: {
    label: "Staff",
    requestKey: "Staff Request",
    requestedState: "Staff Requested",
    approvedState: "Staff Approved",
    closeoutKey: "Staff Closeout",
    closeoutPending: "Staff Closeout Pending",
    closeoutDone: "Staff Closedout",
  },
  equipment: {
    label: "Equipment",
    requestKey: "Equipment Request",
    requestedState: "Equipment Requested",
    approvedState: "Equipment Approved",
    closeoutKey: "Equipment Closeout",
    closeoutPending: "Equipment Closeout Pending",
    closeoutDone: "Equipment Closedout",
  },
  catering: {
    label: "Catering",
    requestKey: "Catering Request",
    requestedState: "Catering Requested",
    approvedState: "Catering Approved",
    closeoutKey: "Catering Closeout",
    closeoutPending: "Catering Closeout Pending",
    closeoutDone: "Catering Closedout",
  },
  cleaning: {
    label: "Cleaning",
    requestKey: "Cleaning Request",
    requestedState: "Cleaning Requested",
    approvedState: "Cleaning Approved",
    closeoutKey: "Cleaning Closeout",
    closeoutPending: "Cleaning Closeout Pending",
    closeoutDone: "Cleaning Closedout",
  },
  security: {
    label: "Security",
    requestKey: "Security Request",
    requestedState: "Security Requested",
    approvedState: "Security Approved",
    closeoutKey: "Security Closeout",
    closeoutPending: "Security Closeout Pending",
    closeoutDone: "Security Closedout",
  },
  setup: {
    label: "Setup",
    requestKey: "Setup Request",
    requestedState: "Setup Requested",
    approvedState: "Setup Approved",
    closeoutKey: "Setup Closeout",
    closeoutPending: "Setup Closeout Pending",
    closeoutDone: "Setup Closedout",
  },
} as const;

type ServiceKey = keyof typeof SERVICE_METADATA;

const ALL_SERVICES: ServiceKey[] = [
  "staff",
  "equipment",
  "catering",
  "cleaning",
  "security",
  "setup",
];

async function seedAdminUserData() {
  const now = createTimestamp(new Date());

  await setDoc(doc({} as any, "mc-usersRights", USERS_RIGHTS_DOC_ID), {
    email: ADMIN_EMAIL,
    isAdmin: true,
    isWorker: true,
    isLiaison: true,
    isEquipment: true,
    isStaffing: true,
    isSetup: true,
    isCatering: true,
    isCleaning: true,
    isSecurity: true,
    createdAt: now,
    updatedAt: now,
  });

  await setDoc(doc({} as any, "mc-usersApprovers", USERS_APPROVER_DOC_ID), {
    email: ADMIN_EMAIL,
    department: "ITP",
    level: 3,
    createdAt: now,
    updatedAt: now,
  });
}

async function seedCheckedOutBookingWithAllServices() {
  const now = new Date();
  const startDate = new Date(now.getTime() + 60 * 60 * 1000);
  const endDate = new Date(startDate.getTime() + 60 * 60 * 1000);
  const zeroTimestamp = createTimestamp(new Date(0));

  const serviceCloseoutValue: Record<string, string> = {};
  for (const [, meta] of Object.entries(SERVICE_METADATA)) {
    serviceCloseoutValue[meta.closeoutKey] = meta.closeoutPending;
  }

  await setDoc(doc({} as any, "mc-bookings", BOOKING_DOC_ID), {
    calendarEventId: CALENDAR_EVENT_ID,
    requestNumber: REQUEST_NUMBER,
    email: REQUESTOR_EMAIL,
    firstName: "CloseoutFull",
    lastName: "Requester",
    secondaryName: "",
    nNumber: "N66778899",
    netId: "closeoutfullreq",
    phoneNumber: "555-777-8888",
    department: "ITP",
    otherDepartment: "",
    role: "Student",
    sponsorFirstName: "Faculty",
    sponsorLastName: "Member",
    sponsorEmail: "faculty.member@nyu.edu",
    title: "Service Closeout Full Flow Test Booking",
    description: "Booking seeded for full service closeout flow.",
    bookingType: "Workshop",
    attendeeAffiliation: "NYU Members with an active NYU ID",
    roomSetup: "Yes",
    setupDetails: "Need setup assistance",
    mediaServices: "",
    mediaServicesDetails: "",
    equipmentServices: "Need cameras",
    equipmentServicesDetails: "Two cameras",
    staffingServices: "Need staff",
    staffingServicesDetails: "One staff member onsite",
    catering: "yes",
    cateringService: "Light snacks",
    cleaningService: "yes",
    hireSecurity: "yes",
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
    finalApprovedBy: ADMIN_EMAIL,
    declinedAt: zeroTimestamp,
    declinedBy: "",
    declineReason: "",
    canceledAt: zeroTimestamp,
    canceledBy: "",
    checkedInAt: createTimestamp(now),
    checkedInBy: ADMIN_EMAIL,
    checkedOutAt: createTimestamp(now),
    checkedOutBy: ADMIN_EMAIL,
    noShowedAt: null,
    noShowedBy: "",
    closedAt: zeroTimestamp,
    closedBy: "",
    walkedInAt: zeroTimestamp,
    origin: BookingOrigin.USER,
    status: BookingStatusLabel.CHECKED_OUT,
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
      machineId: "MC Booking Request",
      lastTransition: new Date().toISOString(),
      snapshot: {
        value: {
          "Service Closeout": serviceCloseoutValue,
        },
        status: BookingStatusLabel.CHECKED_OUT,
        context: {
          status: BookingStatusLabel.CHECKED_OUT,
          calendarEventId: CALENDAR_EVENT_ID,
          servicesRequested: {
            staff: true,
            equipment: true,
            catering: true,
            cleaning: true,
            security: true,
            setup: true,
          },
          servicesApproved: {
            staff: true,
            equipment: true,
            catering: true,
            cleaning: true,
            security: true,
            setup: true,
          },
          servicesDeclined: {},
          servicesClosedOut: {},
        },
      },
    },
  });
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

      const _earlyPatchId = setInterval(() => {
        try {
          if (patchWebpackModules()) {
            clearInterval(_earlyPatchId);
          }
        } catch (_) {}
      }, 2);
      setTimeout(() => clearInterval(_earlyPatchId), 10000);

      try {
        patchWebpackModules();
      } catch (_err) {
        // ignore sync errors
      }

      (window as any).__applyMockBookingsOverrides = () => {
        try {
          patchWebpackModules();
        } catch (_err) {
          // ignore sync errors
        }
      };
    },
    {
      timestampFields: TIMESTAMP_FIELDS_WITH_BY,
      initialBooking: basePayload,
      initialUsersRights: rightsPayload,
      adminEmail: ADMIN_EMAIL,
    }
  );
}

function updateServicesState(
  existing: any,
  serviceType: ServiceKey,
  action: string,
  email: string
) {
  const updated = { ...existing };
  const nextXstate = { ...(existing?.xstateData ?? {}) };
  const snapshot = { ...(nextXstate.snapshot ?? {}) };
  const context = { ...(snapshot.context ?? {}) };
  const servicesClosedOut = { ...(context.servicesClosedOut ?? {}) };

  const serviceMeta = SERVICE_METADATA[serviceType];
  if (!serviceMeta) return updated;

  if (action === "closeout") {
    servicesClosedOut[serviceType] = true;

    const serviceCloseoutStates =
      snapshot.value?.["Service Closeout"] ?? {};
    const updatedCloseoutStates = { ...serviceCloseoutStates };
    updatedCloseoutStates[serviceMeta.closeoutKey] = serviceMeta.closeoutDone;

    const allClosedOut = ALL_SERVICES.every(
      (svc) => servicesClosedOut[svc] === true
    );

    if (allClosedOut) {
      snapshot.value = "Closed";
      snapshot.status = BookingStatusLabel.CLOSED;
      context.status = BookingStatusLabel.CLOSED;
      updated.status = BookingStatusLabel.CLOSED;
      updated.closedAt = createTimestamp(new Date());
      updated.closedBy = email;
    } else {
      snapshot.value = {
        ...(snapshot.value ?? {}),
        "Service Closeout": updatedCloseoutStates,
      };
    }
  }

  context.servicesClosedOut = servicesClosedOut;
  context.lastServiceActionBy = email;
  context.lastServiceActionType = action;
  context.lastServiceActionService = serviceType;

  snapshot.context = context;
  nextXstate.snapshot = snapshot;
  nextXstate.lastTransition = `${action}${serviceMeta.label}`;

  updated.xstateData = nextXstate;
  updated.updatedAt = createTimestamp(new Date());

  return updated;
}

async function mockEndpoints(page: Page, capturedServiceRequests: any[]) {
  await page.route("**/api/services", async (route) => {
    if (route.request().method() !== "POST") {
      await route.fulfill({
        status: 405,
        headers: JSON_HEADERS,
        body: JSON.stringify({ error: "Method Not Allowed" }),
      });
      return;
    }

    const body = route.request().postDataJSON() ?? {};
    capturedServiceRequests.push(body);

    if (
      body?.calendarEventId === CALENDAR_EVENT_ID &&
      body?.serviceType &&
      body?.action
    ) {
      const bookingRef = doc({} as any, "mc-bookings", BOOKING_DOC_ID);
      const snap = await getDoc(bookingRef);
      const existing = snap.data() ?? {};
      const updated = updateServicesState(
        existing,
        body.serviceType,
        body.action,
        body.email ?? ADMIN_EMAIL
      );
      await setDoc(bookingRef, updated);
    }

    await route.fulfill({
      status: 200,
      headers: JSON_HEADERS,
      body: JSON.stringify({ success: true }),
    });
  });

  await page.route("**/api/xstate-transition", async (route) => {
    if (route.request().method() === "POST") {
      await route.fulfill({
        status: 200,
        headers: JSON_HEADERS,
        body: JSON.stringify({ success: true }),
      });
      return;
    }
    await route.fulfill({
      status: 405,
      headers: JSON_HEADERS,
      body: JSON.stringify({ error: "Method Not Allowed" }),
    });
  });

  await page.route("**/api/booking-logs**", async (route) => {
    if (route.request().method() === "POST") {
      await route.fulfill({
        status: 200,
        headers: JSON_HEADERS,
        body: JSON.stringify({ success: true }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      headers: JSON_HEADERS,
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
  await page.goto(`${BASE_URL}/mc/admin`, {
    waitUntil: "domcontentloaded",
  });
  await page.waitForLoadState("networkidle");
  await page.waitForFunction(
    () =>
      typeof (window as any).__applyMockBookingsOverrides === "function"
  );

  await page.evaluate(async () => {
    if (typeof (window as any).__refreshMockBookings === "function") {
      await (window as any).__refreshMockBookings();
    }
    if (typeof (window as any).__applyMockBookingsOverrides === "function") {
      (window as any).__applyMockBookingsOverrides();
    }
  });

  const dateCombobox = page
    .locator('[role="combobox"]')
    .filter({ hasText: /All Future|This Week/ })
    .first();
  await dateCombobox.click();
  await page.getByRole("option", { name: "This Week" }).click();
  await page.waitForTimeout(300);
  await dateCombobox.click();
  await page.getByRole("option", { name: "All Future" }).click();
  await page.waitForTimeout(500);
}

test.describe("Full service closeout flow (mocked Firestore)", () => {
  test("Full service closeout: Checked Out → Service Closeout → Closed", async ({
    page,
  }) => {
    await registerBookingMocks(page);

    await seedAdminUserData();
    await seedCheckedOutBookingWithAllServices();
    await registerMockBookingsFeed(page);

    const capturedServiceRequests: any[] = [];
    await mockEndpoints(page, capturedServiceRequests);

    // Step 1: Navigate to admin page and find booking
    await navigateAndWait(page);

    let currentRow = page
      .locator('[role="row"]')
      .filter({ hasText: "Service Closeout Full Flow Test Booking" })
      .first();
    await currentRow.waitFor({ state: "visible", timeout: 15_000 });

    // Step 2: Verify Checked Out status
    await expect(currentRow).toContainText("Checked Out");

    // Step 3: Closeout each service one by one (6 times, reload after each)
    const serviceOrder: ServiceKey[] = [
      "staff",
      "equipment",
      "catering",
      "cleaning",
      "security",
      "setup",
    ];

    for (const serviceType of serviceOrder) {
      const meta = SERVICE_METADATA[serviceType];

      const serviceRequestPromise = page.waitForRequest((request) => {
        if (
          request.url().includes("/api/services") &&
          request.method() === "POST"
        ) {
          try {
            const payload = request.postDataJSON();
            return (
              payload?.serviceType === serviceType &&
              payload?.action === "closeout"
            );
          } catch (_err) {
            return false;
          }
        }
        return false;
      });

      const serviceResponsePromise = page.waitForResponse((response) => {
        if (
          response.url().includes("/api/services") &&
          response.request().method() === "POST"
        ) {
          try {
            const payload = response.request().postDataJSON();
            return (
              payload?.serviceType === serviceType &&
              payload?.action === "closeout"
            );
          } catch (_err) {
            return false;
          }
        }
        return false;
      });

      currentRow = page
        .locator('[role="row"]')
        .filter({ hasText: "Service Closeout Full Flow Test Booking" })
        .first();
      await currentRow.waitFor({ state: "visible", timeout: 15_000 });

      await currentRow.locator('[role="combobox"]').click();
      await page
        .getByRole("option", { name: `Closeout ${meta.label}` })
        .click();

      const confirmButton = currentRow.locator(
        'button:has(svg[data-testid="CheckIcon"])'
      );
      await confirmButton.waitFor({ state: "visible", timeout: 5_000 });
      await confirmButton.click();

      const serviceRequest = await serviceRequestPromise;
      await serviceResponsePromise;

      const payload = serviceRequest.postDataJSON();
      expect(payload).toMatchObject({
        calendarEventId: CALENDAR_EVENT_ID,
        serviceType,
        action: "closeout",
      });

      // Reload after each service closeout
      await refreshBookingsAndReload(page);
    }

    // Step 4: Verify CLOSED after all services closed out
    currentRow = page
      .locator('[role="row"]')
      .filter({ hasText: "Service Closeout Full Flow Test Booking" })
      .first();
    await currentRow.waitFor({ state: "visible", timeout: 15_000 });
    await expect(currentRow).toContainText("Closed");
  });
});
