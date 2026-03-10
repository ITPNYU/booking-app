import { expect, test } from "@playwright/test";
import { registerBookingMocks } from "./helpers/mock-routes";
import {
  registerDefinePropertyInterceptor,
  registerWebpackPatcher,
} from "./helpers/xstate-mocks";
import {
  selectRole,
  selectTimeSlot,
  fillBookingForm,
} from "./helpers/test-utils";

const BASE_URL =
  process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";
const CALENDAR_EVENT_ID = "mock-edit-event-123";

function createMockExistingBooking() {
  const now = new Date();
  const startDate = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  startDate.setHours(14, 0, 0, 0);
  const endDate = new Date(startDate);
  endDate.setHours(15, 0, 0, 0);

  return {
    id: CALENDAR_EVENT_ID,
    calendarEventId: CALENDAR_EVENT_ID,
    requestNumber: 55555,
    email: "test@nyu.edu",
    firstName: "Test",
    lastName: "Faculty",
    secondaryName: "",
    nNumber: "N12345678",
    netId: "tf123",
    phoneNumber: "2125551234",
    department: "ITP",
    otherDepartment: "",
    role: "Faculty",
    sponsorFirstName: "",
    sponsorLastName: "",
    sponsorEmail: "",
    title: "Original Booking Title",
    description: "Original description",
    bookingType: "Meeting",
    attendeeAffiliation: "NYU Members with an active NYU ID",
    roomSetup: "No",
    setupDetails: "",
    mediaServices: "",
    mediaServicesDetails: "",
    expectedAttendance: "10",
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString(),
    requestedAt: now.toISOString(),
    firstApprovedAt: null,
    finalApprovedAt: null,
    declinedAt: null,
    canceledAt: null,
    checkedInAt: null,
    checkedOutAt: null,
    noShowedAt: null,
    closedAt: null,
    walkedInAt: null,
    status: "REQUESTED",
    roomId: "202",
    selectedRooms: [
      {
        roomId: 202,
        name: "Lecture Hall 202",
        calendarId: "mock-calendar-202",
        shouldAutoApprove: true,
        isEquipment: false,
      },
    ],
  };
}

test.describe("Edit Booking Flow", () => {
  test("edit landing page shows policy warning and Start button", async ({
    page,
  }) => {
    await registerBookingMocks(page);

    await page.goto(`${BASE_URL}/mc/edit/${CALENDAR_EVENT_ID}`, {
      waitUntil: "domcontentloaded",
    });
    await page.waitForLoadState("networkidle");

    // Verify policy text is shown
    const policyText = page.getByText(/restart the approval process/i);
    await policyText.waitFor({ state: "visible", timeout: 15000 });
    await expect(policyText).toBeVisible();

    // Verify Start button is visible
    const startBtn = page.getByRole("button", { name: "Start" });
    await expect(startBtn).toBeVisible();
  });

  test.fixme("submit edit calls PUT /api/bookings/edit", async ({ page }) => {
    await registerBookingMocks(page);
    await registerDefinePropertyInterceptor(page);

    const mockBooking = createMockExistingBooking();

    // Mock the clientGetDataByCalendarEventId to return existing booking
    await page.addInitScript(
      ({ booking }) => {
        const makeTimestamp = (value: string | null | undefined) => {
          if (!value) return null;
          const d = new Date(value);
          return {
            toDate: () => new Date(d),
            toMillis: () => d.getTime(),
            valueOf: () => d.getTime(),
          };
        };

        const enrichedBooking = { ...booking };
        [
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
        ].forEach((field) => {
          if (enrichedBooking[field]) {
            enrichedBooking[field] = makeTimestamp(enrichedBooking[field]);
          }
        });

        const original = (window as any).clientFetchAllDataFromCollection;

        (window as any).clientGetDataByCalendarEventId = async (
          _tableName: any,
          calendarEventId: string,
          _tenant?: string,
        ) => {
          if (calendarEventId === booking.calendarEventId) {
            return { id: booking.id, ...enrichedBooking };
          }
          return null;
        };

        (window as any).clientFetchAllDataFromCollection = async function (
          tableName: string,
          constraints: unknown[],
          tenant: string,
        ) {
          const normalized = tableName ? tableName.toLowerCase() : "";
          if (
            normalized.includes("booking") &&
            !normalized.includes("type") &&
            !normalized.includes("log")
          ) {
            return [{ id: booking.id, ...enrichedBooking }];
          }
          if (original) {
            return await original(tableName, constraints, tenant);
          }
          return [];
        };

      },
      { booking: mockBooking },
    );

    await registerWebpackPatcher(page, {
      exports: [
        "clientFetchAllDataFromCollection",
        "clientGetDataByCalendarEventId",
      ],
    });

    // Mock PUT /api/bookings/edit
    await page.route("**/api/bookings/edit", async (route) => {
      if (route.request().method() === "PUT") {
        return route.fulfill({
          status: 200,
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            success: true,
            booking: { requestNumber: 55555, status: "REQUESTED" },
          }),
        });
      }
      return route.fulfill({ status: 405 });
    });

    // Start from the edit landing page
    await page.goto(`${BASE_URL}/mc/edit/${CALENDAR_EVENT_ID}`, {
      waitUntil: "domcontentloaded",
    });
    await page.waitForLoadState("networkidle");

    // Click Start
    const startBtn = page.getByRole("button", { name: "Start" });
    await startBtn.waitFor({ state: "visible", timeout: 15000 });
    await startBtn.click();

    // Role selection (Faculty)
    await page.waitForURL(`**/edit/role/${CALENDAR_EVENT_ID}`, {
      timeout: 15000,
    });
    await page.waitForLoadState("networkidle");
    await selectRole(page, { roleIndex: 1 });
    await page.getByRole("button", { name: "Next", exact: true }).click();

    // Room & time selection
    await page.waitForURL(`**/edit/selectRoom/${CALENDAR_EVENT_ID}`, {
      timeout: 15000,
    });
    await selectTimeSlot(page, "202");
    await page.waitForTimeout(500);
    const nextBtn = page.getByRole("button", { name: "Next", exact: true });
    await nextBtn.waitFor({ state: "visible", timeout: 10000 });
    await nextBtn.click();

    // Form page
    await page.waitForURL(`**/edit/form/${CALENDAR_EVENT_ID}`, {
      timeout: 15000,
    });
    await page.waitForLoadState("networkidle");

    await fillBookingForm(page, {
      firstName: "Edited",
      lastName: "Faculty",
      netId: "tf123",
      title: "Edited Booking Title",
    });

    // Listen for PUT request
    const putRequestPromise = page.waitForRequest(
      (request) =>
        request.url().includes("/api/bookings/edit") &&
        request.method() === "PUT",
    );

    // Submit - wait for button to be enabled (form validation complete)
    const submitBtn = page.getByRole("button", { name: "Submit" });
    await submitBtn.waitFor({ state: "visible", timeout: 10000 });
    await expect(submitBtn).toBeEnabled({ timeout: 10000 });
    await submitBtn.click();

    // Verify PUT request was made
    const putRequest = await putRequestPromise;
    expect(putRequest.method()).toBe("PUT");
  });
});
