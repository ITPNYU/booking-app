import { expect, test } from "@playwright/test";
import { registerBookingMocks } from "./helpers/mock-routes";
import {
  selectTimeSlot,
  selectRole,
  fillBookingForm,
} from "./helpers/test-utils";

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";

/**
 * Create mock calendar events for tomorrow at specified times.
 */
function createMockCalendarEvents() {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);

  const eventStart = new Date(tomorrow);
  eventStart.setHours(14, 0, 0, 0);
  const eventEnd = new Date(tomorrow);
  eventEnd.setHours(15, 0, 0, 0);

  return [
    {
      id: "existing-event-1",
      calendarEventId: "existing-event-1",
      title: "Existing Booking",
      start: eventStart.toISOString(),
      end: eventEnd.toISOString(),
      resourceId: "202",
      roomId: 202,
      status: "APPROVED",
    },
  ];
}

test.describe("Calendar Constraints", () => {
  test("should complete booking when existing events are present (non-overlapping time)", async ({
    page,
  }) => {
    await registerBookingMocks(page);

    // Override calendar events to include an existing event at 2-3pm tomorrow
    const mockEvents = createMockCalendarEvents();
    await page.route("**/api/calendarEvents**", (route) =>
      route.fulfill({
        status: 200,
        headers: { "content-type": "application/json" },
        body: JSON.stringify(mockEvents),
      }),
    );

    // ── 1. Landing page ──
    await page.goto(`${BASE_URL}/mc`, { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle");

    const requestBtn = page.getByRole("button", {
      name: /Request a Reservation/i,
    });
    await requestBtn.waitFor({ state: "visible", timeout: 15000 });
    await requestBtn.click();

    // ── 2. Terms page ──
    await page.waitForURL("**/mc/book", { timeout: 15000 });
    await page.waitForLoadState("networkidle");
    const acceptBtn = page.getByRole("button", { name: /^I accept$/i });
    await acceptBtn.waitFor({ state: "visible", timeout: 10000 });
    await acceptBtn.click();

    // ── 3. Role selection ──
    await page.waitForURL("**/mc/book/role", { timeout: 15000 });
    await page.waitForLoadState("networkidle");

    await selectRole(page, { roleIndex: 1 }); // Faculty

    await page.getByRole("button", { name: "Next" }).click();

    // ── 4. Room & time selection ──
    // selectTimeSlot picks 10-11am, existing event is at 2-3pm → no overlap
    await page.waitForURL("**/mc/book/selectRoom", { timeout: 15000 });
    await selectTimeSlot(page, "202");

    await page.waitForTimeout(500);
    const nextBtn = page.getByRole("button", { name: "Next", exact: true });
    await nextBtn.waitFor({ state: "visible", timeout: 10000 });
    await nextBtn.click();

    // ── 5. Form details ──
    await page.waitForURL("**/mc/book/form", { timeout: 15000 });
    await page.waitForLoadState("networkidle");

    await fillBookingForm(page, {
      firstName: "Calendar",
      lastName: "Test",
      netId: "ct789",
      title: "Calendar Constraints Test",
    });

    // ── 6. Submit ──
    await page.getByRole("button", { name: "Submit" }).click();

    // ── 7. Confirmation ──
    await page.waitForURL("**/mc/book/confirmation", { timeout: 15000 });

    const heading = page.getByRole("heading", {
      name: /Yay! We've received your booking request/i,
    });
    await heading.waitFor({ state: "visible", timeout: 30000 });
    await expect(heading).toBeVisible();
  });

  test("should handle booking with different time than existing events", async ({
    page,
  }) => {
    await registerBookingMocks(page);

    // Mock calendar events at 2-3pm tomorrow
    const mockEvents = createMockCalendarEvents();
    await page.route("**/api/calendarEvents**", (route) =>
      route.fulfill({
        status: 200,
        headers: { "content-type": "application/json" },
        body: JSON.stringify(mockEvents),
      }),
    );

    // ── Standard booking flow with non-overlapping time (10-11am vs 2-3pm) ──
    await page.goto(`${BASE_URL}/mc`, { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle");

    const requestBtn = page.getByRole("button", {
      name: /Request a Reservation/i,
    });
    await requestBtn.waitFor({ state: "visible", timeout: 15000 });
    await requestBtn.click();

    await page.waitForURL("**/mc/book", { timeout: 15000 });
    await page.waitForLoadState("networkidle");
    await page.getByRole("button", { name: /^I accept$/i }).click();

    await page.waitForURL("**/mc/book/role", { timeout: 15000 });
    await page.waitForLoadState("networkidle");
    await selectRole(page, { roleIndex: 1 });
    await page.getByRole("button", { name: "Next" }).click();

    // selectTimeSlot picks 10-11am tomorrow, existing event is at 2-3pm → no overlap
    await page.waitForURL("**/mc/book/selectRoom", { timeout: 15000 });
    await selectTimeSlot(page, "202");

    await page.waitForTimeout(500);
    const nextBtn = page.getByRole("button", { name: "Next", exact: true });
    await nextBtn.waitFor({ state: "visible", timeout: 10000 });
    await nextBtn.click();

    await page.waitForURL("**/mc/book/form", { timeout: 15000 });
    await page.waitForLoadState("networkidle");

    await fillBookingForm(page, {
      firstName: "NonOverlap",
      lastName: "Test",
      netId: "no456",
      title: "Non-Overlapping Time Test",
    });

    await page.getByRole("button", { name: "Submit" }).click();

    await page.waitForURL("**/mc/book/confirmation", { timeout: 15000 });
    const heading = page.getByRole("heading", {
      name: /Yay! We've received your booking request/i,
    });
    await heading.waitFor({ state: "visible", timeout: 30000 });
    await expect(heading).toBeVisible();
  });
});
