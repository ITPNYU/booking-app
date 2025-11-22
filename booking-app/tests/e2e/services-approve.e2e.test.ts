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

const SERVICE_USER_EMAIL = "test@nyu.edu";
const REQUESTOR_EMAIL = "requestor.services@nyu.edu";

const SERVICE_BOOKING_ID = "mock-services-booking";
const SERVICE_CALENDAR_ID = SERVICE_BOOKING_ID;

const USERS_RIGHTS_DOC_ID = "mock-services-rights";
const USERS_APPROVER_DOC_ID = "mock-services-approver";

const REQUEST_NUMBER = 9700;
const NON_SERVICE_BOOKING_ID = "mock-non-service-booking";

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
  },
  equipment: {
    label: "Equipment",
    requestKey: "Equipment Request",
    requestedState: "Equipment Requested",
    approvedState: "Equipment Approved",
    declinedState: "Equipment Declined",
  },
  catering: {
    label: "Catering",
    requestKey: "Catering Request",
    requestedState: "Catering Requested",
    approvedState: "Catering Approved",
    declinedState: "Catering Declined",
  },
  cleaning: {
    label: "Cleaning",
    requestKey: "Cleaning Request",
    requestedState: "Cleaning Requested",
    approvedState: "Cleaning Approved",
    declinedState: "Cleaning Declined",
  },
  security: {
    label: "Security",
    requestKey: "Security Request",
    requestedState: "Security Requested",
    approvedState: "Security Approved",
    declinedState: "Security Declined",
  },
  setup: {
    label: "Setup",
    requestKey: "Setup Request",
    requestedState: "Setup Requested",
    approvedState: "Setup Approved",
    declinedState: "Setup Declined",
  },
} as const;

const createTimestamp = (date: Date) => {
  const ts = new Timestamp(date);
  (ts as any).toMillis = () => date.getTime();
  (ts as any).toJSON = () => date.toISOString();
  return ts;
};

async function seedServicesUserData() {
  const now = createTimestamp(new Date());

  await setDoc(doc({} as any, "mc-usersRights", USERS_RIGHTS_DOC_ID), {
    email: SERVICE_USER_EMAIL,
    isAdmin: false,
    isWorker: false,
    isLiaison: false,
    isEquipment: true,
    isStaffing: false,
    isSetup: false,
    isCatering: false,
    isCleaning: false,
    isSecurity: false,
    createdAt: now,
    updatedAt: now,
  });

  await setDoc(doc({} as any, "mc-usersApprovers", USERS_APPROVER_DOC_ID), {
    email: SERVICE_USER_EMAIL,
    department: "ITP",
    level: 3,
    createdAt: now,
    updatedAt: now,
  });
}

async function seedServiceRequestBooking() {
  const now = new Date();
  const startDate = new Date(now.getTime() + 60 * 60 * 1000);
  const endDate = new Date(startDate.getTime() + 60 * 60 * 1000);

  const zeroTimestamp = createTimestamp(new Date(0));

  await setDoc(doc({} as any, "mc-bookings", SERVICE_BOOKING_ID), {
    calendarEventId: SERVICE_CALENDAR_ID,
    requestNumber: REQUEST_NUMBER,
    email: REQUESTOR_EMAIL,
    firstName: "Service",
    lastName: "Requester",
    secondaryName: "",
    nNumber: "N22334455",
    netId: "servicereq",
    phoneNumber: "555-444-5555",
    department: "ITP",
    otherDepartment: "",
    role: "Student",
    sponsorFirstName: "Faculty",
    sponsorLastName: "Member",
    sponsorEmail: "faculty.member@nyu.edu",
    title: "Service Request Test Booking",
    description: "Booking seeded for services approval flow tests.",
    bookingType: "Workshop",
    attendeeAffiliation: "NYU Members with an active NYU ID",
    roomSetup: "Yes",
    setupDetails: "Need setup assistance",
    mediaServices: "",
    mediaServicesDetails: "",
    equipmentServices: "Need cameras",
    equipmentServicesDetails: "Two cameras",
    staffingServices: "Need staff support",
    staffingServicesDetails: "One staff member onsite",
    catering: "yes",
    cateringService: "Light snacks",
    cleaningService: "yes",
    hireSecurity: "yes",
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
    status: BookingStatusLabel.EQUIPMENT,
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
          "Services Request": {
            "Staff Request": "Staff Requested",
            "Equipment Request": "Equipment Requested",
            "Catering Request": "Catering Requested",
            "Cleaning Request": "Cleaning Requested",
            "Security Request": "Security Requested",
            "Setup Request": "Setup Requested",
          },
        },
        status: BookingStatusLabel.EQUIPMENT,
        context: {
          status: BookingStatusLabel.EQUIPMENT,
          calendarEventId: SERVICE_CALENDAR_ID,
          servicesRequested: {
            staff: true,
            equipment: true,
            catering: true,
            cleaning: true,
            security: true,
            setup: true,
          },
          servicesApproved: {},
          servicesDeclined: {},
          servicesClosedOut: {},
        },
      },
    },
  });
}

async function seedNonServiceBooking() {
  const now = new Date();
  const startDate = new Date(now.getTime() + 2 * 60 * 60 * 1000);
  const endDate = new Date(startDate.getTime() + 60 * 60 * 1000);

  await setDoc(doc({} as any, "mc-bookings", NON_SERVICE_BOOKING_ID), {
    calendarEventId: NON_SERVICE_BOOKING_ID,
    requestNumber: REQUEST_NUMBER + 5,
    email: "other.service@nyu.edu",
    firstName: "Other",
    lastName: "Service",
    secondaryName: "",
    nNumber: "N66778899",
    netId: "otherservice",
    phoneNumber: "555-222-9999",
    department: "ITP",
    otherDepartment: "",
    role: "Student",
    sponsorFirstName: "Faculty",
    sponsorLastName: "Member",
    sponsorEmail: "faculty.member@nyu.edu",
    title: "Non Service Booking",
    description: "Should not appear in Services tab.",
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
    cleaningService: "no",
    hireSecurity: "no",
    expectedAttendance: "15",
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
    finalApprovedBy: SERVICE_USER_EMAIL,
    declinedAt: createTimestamp(new Date(0)),
    declinedBy: "",
    declineReason: "",
    canceledAt: createTimestamp(new Date(0)),
    canceledBy: "",
    checkedInAt: createTimestamp(new Date(0)),
    checkedInBy: "",
    checkedOutAt: createTimestamp(new Date(0)),
    checkedOutBy: "",
    noShowedAt: createTimestamp(new Date(0)),
    noShowedBy: "",
    closedAt: createTimestamp(new Date(0)),
    closedBy: "",
    walkedInAt: createTimestamp(new Date(0)),
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
      lastTransition: "Pre-approved",
      snapshot: {
        value: "Pre-approved",
        status: BookingStatusLabel.PRE_APPROVED,
        context: {
          status: BookingStatusLabel.PRE_APPROVED,
          calendarEventId: NON_SERVICE_BOOKING_ID,
          servicesRequested: {
            staff: false,
            equipment: false,
            catering: false,
            cleaning: false,
            security: false,
            setup: false,
          },
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

async function registerMockBookingsFeed(page: Page) {
  const docIds = [SERVICE_BOOKING_ID, NON_SERVICE_BOOKING_ID];

  await page.route("**/api/__mock__/bookings", async (route) => {
    const payload: any[] = [];

    for (const id of docIds) {
      const snap = await getDoc(doc({} as any, "mc-bookings", id));
      const data = snap.data();
      if (data) {
        payload.push({
          id,
          calendarEventId: id,
          ...serializeBookingRecord(data),
        });
      }
    }

    await route.fulfill({
      status: 200,
      headers: jsonHeaders,
      body: JSON.stringify(payload),
    });
  });

  const initialPayload: any[] = [];
  for (const id of docIds) {
    const snap = await getDoc(doc({} as any, "mc-bookings", id));
    const data = snap.data();
    if (data) {
      initialPayload.push({
        id,
        calendarEventId: id,
        ...serializeBookingRecord(data),
      });
    }
  }

  await page.addInitScript(
    ({ timestampFields, bookings, serviceEmail }) => {
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
          } else if (booking[field] === null || booking[field] === undefined) {
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
          usersRights: [
            {
              email: serviceEmail,
              isEquipment: true,
              createdAt: new Date().toISOString(),
            },
          ],
          usersApprovers: [
            {
              email: serviceEmail,
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
        const refreshed = await loadBookings();
        return refreshed;
      };

      const originalClientFetch =
        (window as any).clientFetchAllDataFromCollection;
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

        if (originalClientFetch) {
          return await originalClientFetch(tableName, constraints, tenant);
        }

        return [];
      };

      const originalGetPaginatedData = (window as any).getPaginatedData;
      (window as any).getPaginatedData = async function (
        tableName: string,
        limit: number,
        filters: unknown,
        last: unknown,
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

        if (originalGetPaginatedData) {
          return await originalGetPaginatedData(
            tableName,
            limit,
            filters,
            last,
            tenant
          );
        }

        return [];
      };

      const overrideClientGetDataByCalendarEventId = async (
        calendarEventId: string
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
                _tenant?: string
              ) => {
                return await overrideClientGetDataByCalendarEventId(
                  calendarEventId
                );
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

      if (Array.isArray(bookings) && bookings.length > 0) {
        (window as any).__mockBookings = bookings.map(enrichBooking);
        (window as any).__bookingE2EMocks = {
          bookings: (window as any).__mockBookings,
          usersRights: [
            {
              email: serviceEmail,
              isEquipment: true,
              createdAt: new Date().toISOString(),
            },
          ],
          usersApprovers: [
            {
              email: serviceEmail,
              department: "ITP",
              level: 3,
              createdAt: new Date().toISOString(),
            },
          ],
          safetyTrainedUsers: [],
        };
      } else {
        loadBookings();
      }
    },
    {
      timestampFields: TIMESTAMP_FIELDS,
      bookings: initialPayload,
      serviceEmail: SERVICE_USER_EMAIL,
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
  const servicesApproved = { ...(context.servicesApproved ?? {}) };
  const servicesDeclined = { ...(context.servicesDeclined ?? {}) };
  const servicesClosedOut = { ...(context.servicesClosedOut ?? {}) };

  const serviceMeta = SERVICE_METADATA[serviceType];
  if (!serviceMeta) {
    return updated;
  }

  const serviceRequestStates =
    snapshot.value?.["Services Request"] ?? undefined;
  const updatedServiceRequestStates = {
    ...(serviceRequestStates ?? {}),
  };

  if (action === "approve") {
    servicesApproved[serviceType] = true;
    delete servicesDeclined[serviceType];
    updatedServiceRequestStates[serviceMeta.requestKey] =
      serviceMeta.approvedState;
  } else if (action === "decline") {
    servicesDeclined[serviceType] = true;
    delete servicesApproved[serviceType];
    updatedServiceRequestStates[serviceMeta.requestKey] =
      serviceMeta.declinedState;
  } else if (action === "closeout") {
    servicesClosedOut[serviceType] = true;
  }

  context.servicesApproved = servicesApproved;
  context.servicesDeclined = servicesDeclined;
  context.servicesClosedOut = servicesClosedOut;
  context.lastServiceActionBy = email;
  context.lastServiceActionType = action;
  context.lastServiceActionService = serviceType;

  snapshot.context = context;

  snapshot.value = {
    ...(snapshot.value ?? {}),
    "Services Request": updatedServiceRequestStates,
  };

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
      body?.calendarEventId === SERVICE_CALENDAR_ID &&
      body?.serviceType &&
      body?.action
    ) {
      const bookingRef = doc({} as any, "mc-bookings", SERVICE_BOOKING_ID);
      const snap = await getDoc(bookingRef);
      const existing = snap.data() ?? {};
      const updated = updateServicesState(
        existing,
        body.serviceType,
        body.action,
        body.email ?? SERVICE_USER_EMAIL
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

test.describe("Services approval flow (mocked Firestore)", () => {
  test.beforeEach(async ({ page }) => {
    await registerBookingMocks(page);

    await seedServicesUserData();
    await seedServiceRequestBooking();
    await seedNonServiceBooking();
    await registerMockBookingsFeed(page);
  });

  test("should show services request booking and approve each service", async ({
    page,
  }) => {
    const capturedRequests: any[] = [];
    await mockServicesEndpoint(page, capturedRequests);

    page.on("console", (msg) => {
      console.log("[browser]", msg.type(), msg.text());
    });

    await page.goto(`${BASE_URL}/mc/services`, {
      waitUntil: "domcontentloaded",
    });
    await page.waitForLoadState("networkidle");

    await page.waitForFunction(
      () => typeof (window as any).__applyMockBookingsOverrides === "function"
    );
    await page.evaluate(() => {
      if (typeof (window as any).__applyMockBookingsOverrides === "function") {
        (window as any).__applyMockBookingsOverrides();
      }
    });

    await page.waitForFunction(
      () =>
        Array.isArray((window as any).__mockBookings) &&
        (window as any).__mockBookings.length > 0,
      { timeout: 15_000 }
    );
    await page.waitForFunction(
      () =>
        Array.isArray(
          (window as any).__bookingE2EMocks?.bookings as any[]
        ) && (window as any).__bookingE2EMocks.bookings.length > 0,
      { timeout: 15_000 }
    );

    const debugInfo = await page.evaluate(() => {
      const store = (window as any).__bookingE2EMocks;
      const bookings = store?.bookings ?? [];
      return {
        bookingCount: bookings.length,
        ids: bookings.map((b: any) => b.calendarEventId),
        statuses: bookings.map((b: any) => ({
          id: b.calendarEventId,
          status: b.status,
        })),
      };
    });
    console.log("services debug", debugInfo);

    const bookingRow = page
      .locator(`[data-id="${SERVICE_CALENDAR_ID}"]`)
      .first();
    await bookingRow.waitFor({ state: "visible", timeout: 15_000 });

    const dataRows = page.locator('[role="row"][data-rowindex]');
    await expect(dataRows).toHaveCount(1);

    const nonServiceRow = page
      .locator('[role="row"]')
      .filter({ hasText: "Non Service Booking" });
    await expect(nonServiceRow).toHaveCount(0);

    const serviceApprovals: Array<{
      optionLabel: string;
      serviceType: keyof typeof SERVICE_METADATA;
    }> = [
      { optionLabel: "Approve Staff", serviceType: "staff" },
      { optionLabel: "Approve Equipment", serviceType: "equipment" },
      { optionLabel: "Approve Catering", serviceType: "catering" },
      { optionLabel: "Approve Cleaning", serviceType: "cleaning" },
      { optionLabel: "Approve Security", serviceType: "security" },
      { optionLabel: "Approve Setup", serviceType: "setup" },
    ];

    for (const { optionLabel, serviceType } of serviceApprovals) {
      const requestPromise = page.waitForRequest((request) => {
        if (
          request.url().includes("/api/services") &&
          request.method() === "POST"
        ) {
          try {
            const payload = request.postDataJSON();
            return payload?.serviceType === serviceType;
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
            return payload?.serviceType === serviceType;
          } catch (_err) {
            return false;
          }
        }
        return false;
      });

      await bookingRow.locator('[role="combobox"]').click();
      await page.getByRole("option", { name: optionLabel }).click();

      const confirmButton = bookingRow.locator(
        'button:has(svg[data-testid="CheckIcon"])'
      );
      await confirmButton.waitFor({ state: "visible", timeout: 5_000 });
      await confirmButton.click();

      const approveRequest = await requestPromise;
      await responsePromise;

      const payload = approveRequest.postDataJSON();
      expect(payload).toMatchObject({
        calendarEventId: SERVICE_CALENDAR_ID,
        serviceType,
        action: "approve",
        email: SERVICE_USER_EMAIL,
      });

      await page.evaluate(async () => {
        if (typeof (window as any).__refreshMockBookings === "function") {
          await (window as any).__refreshMockBookings();
        }
        if (typeof (window as any).__applyMockBookingsOverrides === "function") {
          (window as any).__applyMockBookingsOverrides();
        }
      });

      await page.waitForTimeout(200);
    }

    const approvedMap = await page.evaluate(() => {
      const booking =
        (window as any).__mockBookings?.find(
          (item: any) =>
            item?.calendarEventId === "mock-services-booking"
        ) ?? null;
      return booking?.xstateData?.snapshot?.context?.servicesApproved ?? {};
    });

    for (const { serviceType } of serviceApprovals) {
      expect(approvedMap?.[serviceType]).toBe(true);
    }

    const approvalCalls = capturedRequests.filter(
      (entry) => entry?.action === "approve" && entry?.serviceType
    );
    expect(approvalCalls).toHaveLength(serviceApprovals.length);
  });
});
