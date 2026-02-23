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
const REQUESTOR_EMAIL = "requestor.closeout@nyu.edu";

const BOOKING_DOC_ID = "mock-closeout-booking";
const CALENDAR_EVENT_ID = BOOKING_DOC_ID;

const USERS_RIGHTS_DOC_ID = "mock-closeout-rights";
const USERS_APPROVER_DOC_ID = "mock-closeout-approver";

const REQUEST_NUMBER = 9880;

const TIMESTAMP_FIELDS = [
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

const SERVICE_METADATA = {
  staff: {
    label: "Staff",
    requestKey: "Staff Request",
    requestedState: "Staff Requested",
    approvedState: "Staff Approved",
    declinedState: "Staff Declined",
    closeoutKey: "Staff Closeout",
    closeoutPending: "Staff Closeout Pending",
    closeoutDone: "Staff Closedout",
  },
  equipment: {
    label: "Equipment",
    requestKey: "Equipment Request",
    requestedState: "Equipment Requested",
    approvedState: "Equipment Approved",
    declinedState: "Equipment Declined",
    closeoutKey: "Equipment Closeout",
    closeoutPending: "Equipment Closeout Pending",
    closeoutDone: "Equipment Closedout",
  },
  catering: {
    label: "Catering",
    requestKey: "Catering Request",
    requestedState: "Catering Requested",
    approvedState: "Catering Approved",
    declinedState: "Catering Declined",
    closeoutKey: "Catering Closeout",
    closeoutPending: "Catering Closeout Pending",
    closeoutDone: "Catering Closedout",
  },
  cleaning: {
    label: "Cleaning",
    requestKey: "Cleaning Request",
    requestedState: "Cleaning Requested",
    approvedState: "Cleaning Approved",
    declinedState: "Cleaning Declined",
    closeoutKey: "Cleaning Closeout",
    closeoutPending: "Cleaning Closeout Pending",
    closeoutDone: "Cleaning Closedout",
  },
  security: {
    label: "Security",
    requestKey: "Security Request",
    requestedState: "Security Requested",
    approvedState: "Security Approved",
    declinedState: "Security Declined",
    closeoutKey: "Security Closeout",
    closeoutPending: "Security Closeout Pending",
    closeoutDone: "Security Closedout",
  },
  setup: {
    label: "Setup",
    requestKey: "Setup Request",
    requestedState: "Setup Requested",
    approvedState: "Setup Approved",
    declinedState: "Setup Declined",
    closeoutKey: "Setup Closeout",
    closeoutPending: "Setup Closeout Pending",
    closeoutDone: "Setup Closedout",
  },
} as const;

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
    isEquipment: true,
    isStaffing: true,
    isSetup: false,
    isCatering: false,
    isCleaning: false,
    isSecurity: false,
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

function buildCloseoutBooking(
  activeService: keyof typeof SERVICE_METADATA,
  bookingStatus: BookingStatusLabel
) {
  const now = new Date();
  const startDate = new Date(now.getTime() - 2 * 60 * 60 * 1000); // past
  const endDate = new Date(startDate.getTime() + 60 * 60 * 1000);
  const zeroTimestamp = createTimestamp(new Date(0));

  const serviceCloseoutValue: Record<string, string> = {};
  const servicesRequested: Record<string, boolean> = {};
  const servicesApproved: Record<string, boolean> = {};

  for (const [key, meta] of Object.entries(SERVICE_METADATA)) {
    if (key === activeService) {
      serviceCloseoutValue[meta.closeoutKey] = meta.closeoutPending;
      servicesRequested[key] = true;
      servicesApproved[key] = true;
    } else {
      serviceCloseoutValue[meta.closeoutKey] = meta.closeoutDone;
      servicesRequested[key] = false;
      servicesApproved[key] = false;
    }
  }

  return {
    calendarEventId: CALENDAR_EVENT_ID,
    requestNumber: REQUEST_NUMBER,
    email: REQUESTOR_EMAIL,
    firstName: "Closeout",
    lastName: "Requester",
    secondaryName: "",
    nNumber: "N22334455",
    netId: "closeoutreq",
    phoneNumber: "555-444-5555",
    department: "ITP",
    otherDepartment: "",
    role: "Student",
    sponsorFirstName: "Faculty",
    sponsorLastName: "Member",
    sponsorEmail: "faculty.member@nyu.edu",
    title: "Service Closeout Test Booking",
    description: "Booking seeded for service closeout flow tests.",
    bookingType: "Workshop",
    attendeeAffiliation: "NYU Members with an active NYU ID",
    roomSetup: activeService === "setup" ? "Yes" : "No",
    setupDetails: activeService === "setup" ? "Need setup assistance" : "",
    mediaServices: "",
    mediaServicesDetails: "",
    equipmentServices: activeService === "equipment" ? "Need cameras" : "",
    equipmentServicesDetails:
      activeService === "equipment" ? "Two cameras" : "",
    staffingServices: activeService === "staff" ? "Need staff" : "",
    staffingServicesDetails:
      activeService === "staff" ? "One staff member onsite" : "",
    catering: activeService === "catering" ? "yes" : "no",
    cateringService: activeService === "catering" ? "Light snacks" : "",
    cleaningService: activeService === "cleaning" ? "yes" : "no",
    hireSecurity: activeService === "security" ? "yes" : "no",
    expectedAttendance: "12",
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
    canceledAt:
      bookingStatus === BookingStatusLabel.CANCELED
        ? createTimestamp(now)
        : zeroTimestamp,
    canceledBy:
      bookingStatus === BookingStatusLabel.CANCELED ? ADMIN_EMAIL : "",
    checkedInAt: createTimestamp(now),
    checkedInBy: ADMIN_EMAIL,
    checkedOutAt: createTimestamp(now),
    checkedOutBy: ADMIN_EMAIL,
    noShowedAt:
      bookingStatus === BookingStatusLabel.CANCELED
        ? createTimestamp(now)
        : null,
    noShowedBy:
      bookingStatus === BookingStatusLabel.CANCELED ? ADMIN_EMAIL : "",
    closedAt: zeroTimestamp,
    closedBy: "",
    walkedInAt: zeroTimestamp,
    origin: BookingOrigin.USER,
    status: bookingStatus,
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
        status: bookingStatus,
        context: {
          status: bookingStatus,
          calendarEventId: CALENDAR_EVENT_ID,
          servicesRequested,
          servicesApproved,
          servicesDeclined: {},
          servicesClosedOut: {},
        },
      },
    },
  };
}

async function seedCloseoutBooking(
  activeService: keyof typeof SERVICE_METADATA,
  bookingStatus: BookingStatusLabel = BookingStatusLabel.CHECKED_OUT
) {
  const bookingData = buildCloseoutBooking(activeService, bookingStatus);
  await setDoc(doc({} as any, "mc-bookings", BOOKING_DOC_ID), bookingData);
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
    Object.defineProperty.toString = () => "function defineProperty() { [native code] }";
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

      loadBookings();

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

      // Extract __webpack_require__ via the webpackChunk push trick
      // and patch module exports
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

      // Proactively patch webpack modules as soon as they're available
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
      timestampFields: TIMESTAMP_FIELDS,
      initialBooking: basePayload,
      initialUsersRights: rightsPayload,
      adminEmail: ADMIN_EMAIL,
    }
  );
}

function updateServicesState(
  existing: any,
  serviceType: keyof typeof SERVICE_METADATA,
  action: string,
  email: string
) {
  const updated = { ...existing };
  const nextXstate = { ...(existing?.xstateData ?? {}) };
  const snapshot = { ...(nextXstate.snapshot ?? {}) };
  const context = { ...(snapshot.context ?? {}) };
  const servicesClosedOut = { ...(context.servicesClosedOut ?? {}) };

  const serviceMeta = SERVICE_METADATA[serviceType];
  if (!serviceMeta) {
    return updated;
  }

  if (action === "closeout") {
    servicesClosedOut[serviceType] = true;

    const serviceCloseoutStates =
      snapshot.value?.["Service Closeout"] ?? {};
    const updatedCloseoutStates = { ...serviceCloseoutStates };
    updatedCloseoutStates[serviceMeta.closeoutKey] = serviceMeta.closeoutDone;

    snapshot.value = {
      ...(snapshot.value ?? {}),
      "Service Closeout": updatedCloseoutStates,
    };
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

async function mockServicesEndpoint(page: Page, captured: any[]) {
  await page.route("**/api/services", async (route) => {
    if (route.request().method() !== "POST") {
      await route.fulfill({
        status: 405,
        headers: jsonHeaders,
        body: JSON.stringify({ error: "Method Not Allowed" }),
      });
      return;
    }

    const body = route.request().postDataJSON() ?? {};
    captured.push(body);

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
      headers: jsonHeaders,
      body: JSON.stringify({ success: true }),
    });
  });
}

async function mockTransitionEndpoints(page: Page) {
  await page.route("**/api/xstate-transition", async (route) => {
    if (route.request().method() === "POST") {
      await route.fulfill({
        status: 200,
        headers: jsonHeaders,
        body: JSON.stringify({ success: true }),
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

test.describe("Service closeout flows (mocked Firestore)", () => {
  test("Admin can closeout a service from Service Closeout state", async ({
    page,
  }) => {
    await registerBookingMocks(page);

    await seedAdminUserData();
    await seedCloseoutBooking("staff");
    await registerMockBookingsFeed(page);

    const capturedRequests: any[] = [];
    await mockServicesEndpoint(page, capturedRequests);
    await mockTransitionEndpoints(page);

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
      .filter({ hasText: "Service Closeout Test Booking" })
      .first();
    await bookingRow.waitFor({ state: "visible", timeout: 15_000 });

    // Set up request interception AFTER page load, before triggering action
    const requestPromise = page.waitForRequest((request) => {
      if (
        request.url().includes("/api/services") &&
        request.method() === "POST"
      ) {
        try {
          const payload = request.postDataJSON();
          return payload?.serviceType === "staff" && payload?.action === "closeout";
        } catch (_err) {
          return false;
        }
      }
      return false;
    });

    const responsePromise = page.waitForResponse((response) => {
      if (
        response.url().includes("/api/services") &&
        response.request().method() === "POST"
      ) {
        try {
          const payload = response.request().postDataJSON();
          return payload?.serviceType === "staff" && payload?.action === "closeout";
        } catch (_err) {
          return false;
        }
      }
      return false;
    });

    await bookingRow.locator('[role="combobox"]').click();
    await page.getByRole("option", { name: "Closeout Staff" }).click();

    const confirmButton = bookingRow.locator(
      'button:has(svg[data-testid="CheckIcon"])'
    );
    await confirmButton.waitFor({ state: "visible", timeout: 5_000 });
    await confirmButton.click();

    const closeoutRequest = await requestPromise;
    await responsePromise;

    const payload = closeoutRequest.postDataJSON();
    expect(payload).toMatchObject({
      calendarEventId: CALENDAR_EVENT_ID,
      serviceType: "staff",
      action: "closeout",
    });
  });

  test("Service closeout shows for canceled booking with services", async ({
    page,
  }) => {
    await registerBookingMocks(page);

    await seedAdminUserData();
    await seedCloseoutBooking("staff", BookingStatusLabel.CANCELED);
    await registerMockBookingsFeed(page);

    const capturedRequests: any[] = [];
    await mockServicesEndpoint(page, capturedRequests);
    await mockTransitionEndpoints(page);

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
      .filter({ hasText: "Service Closeout Test Booking" })
      .first();
    await bookingRow.waitFor({ state: "visible", timeout: 15_000 });

    // Set up request interception AFTER page load, before triggering action
    const requestPromise = page.waitForRequest((request) => {
      if (
        request.url().includes("/api/services") &&
        request.method() === "POST"
      ) {
        try {
          const payload = request.postDataJSON();
          return payload?.serviceType === "staff" && payload?.action === "closeout";
        } catch (_err) {
          return false;
        }
      }
      return false;
    });

    const responsePromise = page.waitForResponse((response) => {
      if (
        response.url().includes("/api/services") &&
        response.request().method() === "POST"
      ) {
        try {
          const payload = response.request().postDataJSON();
          return payload?.serviceType === "staff" && payload?.action === "closeout";
        } catch (_err) {
          return false;
        }
      }
      return false;
    });

    await bookingRow.locator('[role="combobox"]').click();
    await page.getByRole("option", { name: "Closeout Staff" }).click();

    const confirmButton = bookingRow.locator(
      'button:has(svg[data-testid="CheckIcon"])'
    );
    await confirmButton.waitFor({ state: "visible", timeout: 5_000 });
    await confirmButton.click();

    const closeoutRequest = await requestPromise;
    await responsePromise;

    const payload = closeoutRequest.postDataJSON();
    expect(payload).toMatchObject({
      calendarEventId: CALENDAR_EVENT_ID,
      serviceType: "staff",
      action: "closeout",
    });
  });
});
