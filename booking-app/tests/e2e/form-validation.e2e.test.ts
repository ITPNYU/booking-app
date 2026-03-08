import { expect, test } from "@playwright/test";
import { registerBookingMocks } from "./helpers/mock-routes";
import { registerDefinePropertyInterceptor } from "./helpers/xstate-mocks";
import { selectRole, selectTimeSlot } from "./helpers/test-utils";

const BASE_URL =
  process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";

test.describe("Form Validation – overlap and duration errors", () => {
  test("shows overlap error when time conflicts with existing reservation", async ({
    page,
  }) => {
    await registerBookingMocks(page);

    // Create an overlapping calendar event at 10-11am tomorrow (same slot selectTimeSlot picks)
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const eventStart = new Date(tomorrow);
    eventStart.setHours(10, 0, 0, 0);
    const eventEnd = new Date(tomorrow);
    eventEnd.setHours(11, 0, 0, 0);

    const overlappingEvents = [
      {
        id: "overlap-event-1",
        calendarEventId: "overlap-event-1",
        title: "Existing Booking",
        start: eventStart.toISOString(),
        end: eventEnd.toISOString(),
        resourceId: "202",
        roomId: 202,
        status: "APPROVED",
      },
    ];

    await page.route("**/api/calendarEvents**", (route) =>
      route.fulfill({
        status: 200,
        headers: { "content-type": "application/json" },
        body: JSON.stringify(overlappingEvents),
      }),
    );

    // Navigate through the booking flow
    await page.goto(`${BASE_URL}/mc`, { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle");

    const requestBtn = page.getByRole("button", {
      name: /Request a Reservation/i,
    });
    await requestBtn.waitFor({ state: "visible", timeout: 15000 });
    await requestBtn.click();

    // Terms
    await page.waitForURL("**/mc/book", { timeout: 15000 });
    await page.waitForLoadState("networkidle");
    await page.getByRole("button", { name: /^I accept$/i }).click();

    // Role selection (Faculty)
    await page.waitForURL("**/mc/book/role", { timeout: 15000 });
    await page.waitForLoadState("networkidle");
    await selectRole(page, { roleIndex: 1 });
    await page.getByRole("button", { name: "Next", exact: true }).click();

    // Room & time – selectTimeSlot picks 10-11am tomorrow for room 202
    await page.waitForURL("**/mc/book/selectRoom", { timeout: 15000 });
    await selectTimeSlot(page, "202");
    await page.waitForTimeout(500);

    // Verify overlap alert is shown
    const alert = page.getByRole("alert").filter({
      hasText: /conflicts with at least one existing reservation/i,
    });
    await alert.waitFor({ state: "visible", timeout: 10000 });
    await expect(alert).toBeVisible();

    // Verify Next button is disabled
    const nextBtn = page.getByRole("button", { name: "Next", exact: true });
    await expect(nextBtn).toBeDisabled();
  });

  test("shows duration error when booking exceeds maximum allowed duration", async ({
    page,
  }) => {
    // Room 203 (Seminar) has maxHour: { faculty: 0.5 } in the base test schema.
    await registerBookingMocks(page);

    // Navigate through the booking flow
    await page.goto(`${BASE_URL}/mc`, { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle");

    const requestBtn = page.getByRole("button", {
      name: /Request a Reservation/i,
    });
    await requestBtn.waitFor({ state: "visible", timeout: 15000 });
    await requestBtn.click();

    // Terms
    await page.waitForURL("**/mc/book", { timeout: 15000 });
    await page.waitForLoadState("networkidle");
    await page.getByRole("button", { name: /^I accept$/i }).click();

    // Role selection (Faculty)
    await page.waitForURL("**/mc/book/role", { timeout: 15000 });
    await page.waitForLoadState("networkidle");
    await selectRole(page, { roleIndex: 1 });
    await page.getByRole("button", { name: "Next", exact: true }).click();

    // Room & time – selectTimeSlot picks 10-11am (1 hour), room 203 maxHour is 0.5
    await page.waitForURL("**/mc/book/selectRoom", { timeout: 15000 });
    await selectTimeSlot(page, "203");
    await page.waitForTimeout(500);

    // Verify duration error alert is shown
    const alert = page.getByRole("alert").filter({
      hasText: /exceeds the maximum allowed duration/i,
    });
    await alert.waitFor({ state: "visible", timeout: 10000 });
    await expect(alert).toBeVisible();

    // Verify Next button is disabled
    const nextBtn = page.getByRole("button", { name: "Next", exact: true });
    await expect(nextBtn).toBeDisabled();
  });
});
