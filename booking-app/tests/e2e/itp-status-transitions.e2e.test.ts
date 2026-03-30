import { expect, Page, test } from "@playwright/test";

import {
  BookingOrigin,
  BookingStatusLabel,
} from "../../components/src/types";
import {
  doc,
  setDoc,
} from "../../lib/firebase/stubs/firebaseFirestoreStub";
import { registerItpBookingMocks } from "./helpers/itp-mock-routes";
import { applyMockOverrides } from "./helpers/test-utils";
import {
  createTimestamp,
  registerMockBookingsFeed,
} from "./helpers/xstate-mocks";

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";
const jsonHeaders = { "content-type": "application/json" };

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

async function setupItpMockBookingsFeed(page: Page) {
  await registerMockBookingsFeed(page, {
    bookingDocId: BOOKING_DOC_ID,
    calendarEventId: CALENDAR_EVENT_ID,
    usersRightsDocId: USERS_RIGHTS_DOC_ID,
    adminEmail: ADMIN_EMAIL,
    tenant: "itp",
  });
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

    await setupItpMockBookingsFeed(page);
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

    await setupItpMockBookingsFeed(page);
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

    await setupItpMockBookingsFeed(page);
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

    await setupItpMockBookingsFeed(page);
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
