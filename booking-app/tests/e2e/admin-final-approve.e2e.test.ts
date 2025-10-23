import { expect, Page, test } from "@playwright/test";

import {
  BookingOrigin,
  BookingStatusLabel,
} from "../../components/src/types";
import {
  addDoc,
  collection,
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
const REQUESTOR_EMAIL = "requestor.admin@nyu.edu";

const BOOKING_DOC_ID = "mock-admin-booking";
const CALENDAR_EVENT_ID = BOOKING_DOC_ID;

const USERS_RIGHTS_DOC_ID = "mock-admin-rights";
const USERS_APPROVER_DOC_ID = "mock-admin-first-approver";

const REQUEST_NUMBER = 9500;
const NON_VISIBLE_BOOKINGS = [
  {
    id: "mock-admin-requested",
    calendarEventId: "mock-admin-requested",
    status: BookingStatusLabel.REQUESTED,
    xstateValue: "Requested",
  },
  {
    id: "mock-admin-declined",
    calendarEventId: "mock-admin-declined",
    status: BookingStatusLabel.DECLINED,
    xstateValue: "Declined",
  },
];
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

  await setDoc(doc({} as any, "mc-usersApprovers", USERS_APPROVER_DOC_ID), {
    email: ADMIN_EMAIL,
    department: "ITP",
    level: 2,
    createdAt: now,
    updatedAt: now,
  });
}

async function seedPreApprovedBooking() {
  const now = new Date();
  const startDate = new Date(now.getTime() + 60 * 60 * 1000);
  const endDate = new Date(startDate.getTime() + 60 * 60 * 1000);

  await setDoc(doc({} as any, "mc-bookings", BOOKING_DOC_ID), {
    calendarEventId: CALENDAR_EVENT_ID,
    requestNumber: REQUEST_NUMBER,
    email: REQUESTOR_EMAIL,
    firstName: "Admin",
    lastName: "Requester",
    secondaryName: "",
    nNumber: "N44556677",
    netId: "adminreq",
    phoneNumber: "555-333-4444",
    department: "ITP",
    otherDepartment: "",
    role: "Student",
    sponsorFirstName: "Faculty",
    sponsorLastName: "Member",
    sponsorEmail: "faculty.member@nyu.edu",
    title: "Admin Approval Test Booking",
    description: "Booking seeded for admin approval tests.",
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
    finalApprovedAt: createTimestamp(new Date(0)),
    finalApprovedBy: "",
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
    status: BookingStatusLabel.PRE_APPROVED,
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
          calendarEventId: CALENDAR_EVENT_ID,
          servicesRequested: {},
          servicesApproved: {},
        },
      },
    },
  });
}

async function seedNonVisibleBookings() {
  const now = new Date();
  const startDate = new Date(now.getTime() + 2 * 60 * 60 * 1000);
  const endDate = new Date(startDate.getTime() + 60 * 60 * 1000);

  for (const booking of NON_VISIBLE_BOOKINGS) {
    await setDoc(doc({} as any, "mc-bookings", booking.id), {
      calendarEventId: booking.calendarEventId,
      requestNumber: REQUEST_NUMBER + 20,
      email: "other-admin@nyu.edu",
      firstName: "Other",
      lastName: "AdminTest",
      secondaryName: "",
      nNumber: "N55667788",
      netId: "otheradm",
      phoneNumber: "555-777-8888",
      department: "ITP",
      otherDepartment: "",
      role: "Student",
      sponsorFirstName: "Faculty",
      sponsorLastName: "Member",
      sponsorEmail: "faculty.member@nyu.edu",
      title: `Hidden Booking (${booking.status})`,
      description: "Should not be visible on admin pre-approved list.",
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
      expectedAttendance: "10",
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
      declinedAt: createTimestamp(now),
      declinedBy: ADMIN_EMAIL,
      declineReason: "Manual seed",
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
      status: booking.status,
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
        lastTransition: booking.xstateValue,
        snapshot: {
          value: booking.xstateValue,
          status: booking.status,
          context: {
            status: booking.status,
            calendarEventId: booking.calendarEventId,
            servicesRequested: {},
            servicesApproved: {},
          },
        },
      },
    });
  }
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

  await page.route("**/api/__mock__/bookings", async (route) => {
    const latestSnapshot = await getDoc(
      doc({} as any, "mc-bookings", BOOKING_DOC_ID)
    );
    const latestData = latestSnapshot.data();
    const allDocs = [BOOKING_DOC_ID, ...NON_VISIBLE_BOOKINGS.map((b) => b.id)];

    const payload = await Promise.all(
      allDocs.map(async (id) => {
        const docSnap = await getDoc(doc({} as any, "mc-bookings", id));
        const data = docSnap.data();
        if (!data) return null;
        return {
          id,
          calendarEventId: id,
          ...serializeBookingRecord(data),
        };
      })
    );

    const filteredPayload = payload.filter(Boolean);

    await route.fulfill({
      status: 200,
      headers: jsonHeaders,
      body: JSON.stringify(filteredPayload),
    });
  });

  await page.addInitScript(
    ({ timestampFields, initialBooking, adminEmail }) => {
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
              email: adminEmail,
              isAdmin: true,
              createdAt: new Date().toISOString(),
            },
          ],
          usersApprovers: [
            {
              email: adminEmail,
              department: "ITP",
              level: 2,
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

      if (initialBooking) {
        (window as any).__mockBookings = [enrichBooking(initialBooking)];
        (window as any).__bookingE2EMocks = {
          bookings: (window as any).__mockBookings,
          usersRights: [
            {
              email: adminEmail,
              isAdmin: true,
              createdAt: new Date().toISOString(),
            },
          ],
          usersApprovers: [
            {
              email: adminEmail,
              department: "ITP",
              level: 2,
              createdAt: new Date().toISOString(),
            },
          ],
        };
      }
    },
    {
      timestampFields: TIMESTAMP_FIELDS,
      initialBooking: basePayload,
      adminEmail: ADMIN_EMAIL,
    }
  );
}

async function mockAdminEndpoints(page: Page) {
  await page.route("**/api/approve", async (route) => {
    if (route.request().method() !== "POST") {
      await route.fulfill({
        status: 405,
        body: JSON.stringify({ error: "Method Not Allowed" }),
        headers: { "content-type": "application/json" },
      });
      return;
    }

    const body = route.request().postDataJSON();
    const email = body?.email ?? ADMIN_EMAIL;
    const approvedAt = createTimestamp(new Date());

    const bookingRef = doc({} as any, "mc-bookings", BOOKING_DOC_ID);
    const bookingSnapshot = await getDoc(bookingRef);
    const bookingData = bookingSnapshot.data() ?? {};

    const updatedBooking = {
      ...bookingData,
      status: BookingStatusLabel.APPROVED,
      finalApprovedAt: approvedAt,
      finalApprovedBy: email,
      xstateData: {
        ...(bookingData?.xstateData ?? {}),
        lastTransition: "approve",
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

    await addDoc(collection({} as any, "mc-bookingLogs"), {
      bookingId: BOOKING_DOC_ID,
      calendarEventId: CALENDAR_EVENT_ID,
      status: BookingStatusLabel.APPROVED,
      changedBy: email,
      changedAt: approvedAt,
      requestNumber: bookingData?.requestNumber ?? REQUEST_NUMBER,
      note: "Booking final approved (mock)",
    });

    await route.fulfill({
      status: 200,
      headers: jsonHeaders,
      body: JSON.stringify({ message: "Approved successfully" }),
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

test.describe("Admin final approval flow", () => {
  test.beforeEach(async ({ page }) => {
    await registerBookingMocks(page);

    await seedAdminUserData();
    await seedPreApprovedBooking();
    await seedNonVisibleBookings();
    await registerMockBookingsFeed(page);

    await mockAdminEndpoints(page);
  });

  test("should show only pre-approved bookings", async ({ page }) => {
    await page.goto(`${BASE_URL}/mc/admin`, {
      waitUntil: "domcontentloaded",
    });
    await page.waitForLoadState("networkidle");

    const visibleRow = page.locator(`[data-id="${CALENDAR_EVENT_ID}"]`);
    await visibleRow.waitFor({ state: "visible", timeout: 15_000 });

    for (const hidden of NON_VISIBLE_BOOKINGS) {
      await expect(page.locator(`[data-id="${hidden.id}"]`)).toHaveCount(0);
    }
  });

  test("should send approve request when admin does final approve", async ({
    page,
  }) => {
    await page.goto(`${BASE_URL}/mc/admin`, {
      waitUntil: "domcontentloaded",
    });
    await page.waitForLoadState("networkidle");

    const bookingRow = page.locator(`[data-id="${CALENDAR_EVENT_ID}"]`);
    await bookingRow.waitFor({ state: "visible", timeout: 15_000 });

    const approveRequestPromise = page.waitForRequest((request) =>
      request.url().includes("/api/approve") &&
      request.method() === "POST"
    );
    const approveResponsePromise = page.waitForResponse((response) =>
      response.url().includes("/api/approve") &&
      response.request().method() === "POST"
    );

    await bookingRow.locator('[role="combobox"]').click();
    await page.getByRole("option", { name: "2nd Approve" }).click();

    const confirmButton = bookingRow.locator(
      'button:has(svg[data-testid="CheckIcon"])'
    );
    await confirmButton.waitFor({ state: "visible", timeout: 5_000 });
    await confirmButton.click();

    const approveRequest = await approveRequestPromise;
    await approveResponsePromise;

    const approvePayload = approveRequest.postDataJSON() ?? {};
    expect(approvePayload).toMatchObject({
      id: CALENDAR_EVENT_ID,
      email: ADMIN_EMAIL,
    });
  });

  test("should send decline request when admin declines", async ({ page }) => {
    await page.goto(`${BASE_URL}/mc/admin`, {
      waitUntil: "domcontentloaded",
    });
    await page.waitForLoadState("networkidle");

    const bookingRow = page.locator(`[data-id="${CALENDAR_EVENT_ID}"]`);
    await bookingRow.waitFor({ state: "visible", timeout: 15_000 });

    const declineRequestPromise = page.waitForRequest((request) =>
      request.url().includes("/api/xstate-transition") &&
      request.method() === "POST"
    );
    const declineResponsePromise = page.waitForResponse((response) =>
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
