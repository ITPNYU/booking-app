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
  createTimestamp,
  registerMockBookingsFeed,
} from "./helpers/xstate-mocks";

const BASE_URL =
  process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";

const ADMIN_EMAIL = "test@nyu.edu";
const REQUESTOR_EMAIL = "requestor.svc-full@nyu.edu";

const BOOKING_DOC_ID = "mock-svc-full-flow-booking";
const CALENDAR_EVENT_ID = BOOKING_DOC_ID;

const USERS_RIGHTS_DOC_ID = "mock-svc-full-flow-rights";
const USERS_APPROVER_DOC_ID = "mock-svc-full-flow-approver";

const REQUEST_NUMBER = 9910;

const SERVICE_METADATA = {
  staff: {
    label: "Staff",
    requestKey: "Staff Request",
    requestedState: "Staff Requested",
    approvedState: "Staff Approved",
  },
  equipment: {
    label: "Equipment",
    requestKey: "Equipment Request",
    requestedState: "Equipment Requested",
    approvedState: "Equipment Approved",
  },
  catering: {
    label: "Catering",
    requestKey: "Catering Request",
    requestedState: "Catering Requested",
    approvedState: "Catering Approved",
  },
  cleaning: {
    label: "Cleaning",
    requestKey: "Cleaning Request",
    requestedState: "Cleaning Requested",
    approvedState: "Cleaning Approved",
  },
  security: {
    label: "Security",
    requestKey: "Security Request",
    requestedState: "Security Requested",
    approvedState: "Security Approved",
  },
  setup: {
    label: "Setup",
    requestKey: "Setup Request",
    requestedState: "Setup Requested",
    approvedState: "Setup Approved",
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

async function seedRequestedBookingWithAllServices() {
  const now = new Date();
  const startDate = new Date(now.getTime() + 60 * 60 * 1000);
  const endDate = new Date(startDate.getTime() + 60 * 60 * 1000);
  const zeroTimestamp = createTimestamp(new Date(0));

  await setDoc(doc({} as any, "mc-bookings", BOOKING_DOC_ID), {
    calendarEventId: CALENDAR_EVENT_ID,
    requestNumber: REQUEST_NUMBER,
    email: REQUESTOR_EMAIL,
    firstName: "ServiceFull",
    lastName: "Requester",
    secondaryName: "",
    nNumber: "N55667788",
    netId: "svcfullreq",
    phoneNumber: "555-666-7777",
    department: "ITP",
    otherDepartment: "",
    role: "Student",
    sponsorFirstName: "Faculty",
    sponsorLastName: "Member",
    sponsorEmail: "faculty.member@nyu.edu",
    title: "Service Full Flow Test Booking",
    description: "Booking seeded for full service approval flow.",
    bookingType: "Workshop",
    attendeeAffiliation: "NYU Members with an active NYU ID",
    roomSetup: "Yes",
    setupDetails: "Need setup",
    mediaServices: "",
    mediaServicesDetails: "",
    equipmentServices: "Need cameras",
    equipmentServicesDetails: "Two cameras",
    staffingServices: "Need staff",
    staffingServicesDetails: "One staff member",
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
    noShowedAt: null,
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
      machineId: "MC Booking Request",
      lastTransition: null,
      snapshot: {
        value: "Requested",
        status: BookingStatusLabel.REQUESTED,
        context: {
          status: BookingStatusLabel.REQUESTED,
          calendarEventId: CALENDAR_EVENT_ID,
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
        },
      },
    },
  });
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
  const servicesApproved = { ...(context.servicesApproved ?? {}) };

  const serviceMeta = SERVICE_METADATA[serviceType];
  if (!serviceMeta) return updated;

  if (action === "approve") {
    servicesApproved[serviceType] = true;

    const serviceRequestStates =
      snapshot.value?.["Services Request"] ?? {};
    const updatedStates = { ...serviceRequestStates };
    updatedStates[serviceMeta.requestKey] = serviceMeta.approvedState;

    const allApproved = ALL_SERVICES.every(
      (svc) => servicesApproved[svc] === true
    );

    if (allApproved) {
      snapshot.value = "Approved";
      snapshot.status = BookingStatusLabel.APPROVED;
      context.status = BookingStatusLabel.APPROVED;
      updated.status = BookingStatusLabel.APPROVED;
      updated.finalApprovedAt = createTimestamp(new Date());
      updated.finalApprovedBy = email;
    } else {
      snapshot.value = {
        ...(snapshot.value ?? {}),
        "Services Request": updatedStates,
      };
    }
  }

  context.servicesApproved = servicesApproved;
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
  let approveCallCount = 0;

  await page.route("**/api/approve", async (route) => {
    if (route.request().method() !== "POST") {
      await route.fulfill({
        status: 405,
        headers: JSON_HEADERS,
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
      // 2nd Approve → Services Request parallel state
      const servicesRequestValue: Record<string, string> = {};
      for (const [, meta] of Object.entries(SERVICE_METADATA)) {
        servicesRequestValue[meta.requestKey] = meta.requestedState;
      }

      const updatedBooking = {
        ...bookingData,
        status: BookingStatusLabel.PRE_APPROVED,
        finalApprovedAt: approvedAt,
        finalApprovedBy: email,
        xstateData: {
          ...(bookingData?.xstateData ?? {}),
          lastTransition: "Services Request",
          snapshot: {
            ...(bookingData?.xstateData?.snapshot ?? {}),
            value: {
              "Services Request": servicesRequestValue,
            },
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
    }

    await route.fulfill({
      status: 200,
      headers: JSON_HEADERS,
      body: JSON.stringify({ message: "Approved successfully" }),
    });
  });

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

test.describe("Full service approval flow (mocked Firestore)", () => {
  test("Full service approval: Requested → Services Request → Approved", async ({
    page,
  }) => {
    await registerBookingMocks(page);

    await seedAdminUserData();
    await seedRequestedBookingWithAllServices();
    await registerMockBookingsFeed(page, {
      bookingDocId: BOOKING_DOC_ID,
      calendarEventId: CALENDAR_EVENT_ID,
      usersRightsDocId: USERS_RIGHTS_DOC_ID,
      adminEmail: ADMIN_EMAIL,
    });

    const capturedServiceRequests: any[] = [];
    await mockEndpoints(page, capturedServiceRequests);

    // Step 1: Navigate to admin page and find booking
    await navigateAndWait(page);

    const bookingRow = page
      .locator('[role="row"]')
      .filter({ hasText: "Service Full Flow Test Booking" })
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

    let currentRow = page
      .locator('[role="row"]')
      .filter({ hasText: "Service Full Flow Test Booking" })
      .first();
    await currentRow.waitFor({ state: "visible", timeout: 15_000 });
    await expect(currentRow).toContainText("Pre-Approved");

    // Step 4: 2nd Approve → Services Request (displayed as Pre-Approved)
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

    await currentRow.locator('[role="combobox"]').click();
    await page.getByRole("option", { name: "2nd Approve" }).click();

    confirmButton = currentRow.locator(
      'button:has(svg[data-testid="CheckIcon"])'
    );
    await confirmButton.waitFor({ state: "visible", timeout: 5_000 });
    await confirmButton.click();

    await approveRequestPromise;
    await approveResponsePromise;

    // Step 5: Reload and verify still Pre-Approved (Services Request shows as Pre-Approved)
    await refreshBookingsAndReload(page);

    currentRow = page
      .locator('[role="row"]')
      .filter({ hasText: "Service Full Flow Test Booking" })
      .first();
    await currentRow.waitFor({ state: "visible", timeout: 15_000 });
    await expect(currentRow).toContainText("Pre-Approved");

    // Step 6: Approve each service one by one (6 times, reload after each)
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
              payload?.action === "approve"
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
              payload?.action === "approve"
            );
          } catch (_err) {
            return false;
          }
        }
        return false;
      });

      currentRow = page
        .locator('[role="row"]')
        .filter({ hasText: "Service Full Flow Test Booking" })
        .first();
      await currentRow.waitFor({ state: "visible", timeout: 15_000 });

      await currentRow.locator('[role="combobox"]').click();
      await page
        .getByRole("option", { name: `Approve ${meta.label}` })
        .click();

      confirmButton = currentRow.locator(
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
        action: "approve",
      });

      // Reload after each service approval
      await refreshBookingsAndReload(page);
    }

    // Step 7: Verify APPROVED after all services approved
    currentRow = page
      .locator('[role="row"]')
      .filter({ hasText: "Service Full Flow Test Booking" })
      .first();
    await currentRow.waitFor({ state: "visible", timeout: 15_000 });
    await expect(currentRow).toContainText("Approved");
  });
});
