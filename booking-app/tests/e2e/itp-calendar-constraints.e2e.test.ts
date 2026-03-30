import { expect, test } from "@playwright/test";
import { registerItpBookingMocks } from "./helpers/itp-mock-routes";
import {
  itpNavigateToRoleSelection,
  itpSelectRole,
  itpSelectTimeSlot,
  itpFillBookingForm,
} from "./helpers/itp-test-utils";

function createItpMockCalendarEvents() {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);

  const eventStart = new Date(tomorrow);
  eventStart.setHours(14, 0, 0, 0);
  const eventEnd = new Date(tomorrow);
  eventEnd.setHours(15, 0, 0, 0);

  return [
    {
      id: "itp-existing-event-1",
      calendarEventId: "itp-existing-event-1",
      title: "Existing ITP Booking",
      start: eventStart.toISOString(),
      end: eventEnd.toISOString(),
      resourceId: "408",
      roomId: 408,
      status: "APPROVED",
    },
  ];
}

test.describe("ITP Calendar Constraints", () => {
  test("should complete ITP booking when existing events are present (non-overlapping time)", async ({
    page,
  }) => {
    await registerItpBookingMocks(page);

    // Override calendar events to include an existing event at 2-3pm tomorrow
    const mockEvents = createItpMockCalendarEvents();
    await page.route("**/api/calendarEvents**", (route) => {
      const url = new URL(route.request().url());
      const calendarIds = url.searchParams.get("calendarIds");
      if (calendarIds) {
        const grouped: Record<string, any[]> = {};
        for (const id of calendarIds.split(",")) {
          grouped[id] = id === "mock-calendar-408" ? mockEvents : [];
        }
        return route.fulfill({
          status: 200,
          headers: { "content-type": "application/json" },
          body: JSON.stringify(grouped),
        });
      }
      return route.fulfill({
        status: 200,
        headers: { "content-type": "application/json" },
        body: JSON.stringify(mockEvents),
      });
    });

    await itpNavigateToRoleSelection(page);

    // Faculty = index 1
    await itpSelectRole(page, { roleIndex: 1 });
    await page.getByRole("button", { name: "Next", exact: true }).click();

    // selectTimeSlot picks 10-11am, existing event is at 2-3pm → no overlap
    await page.waitForURL("**/itp/book/selectRoom", { timeout: 15000 });
    await itpSelectTimeSlot(page, "408");
    await page.waitForTimeout(500);
    await page.getByRole("button", { name: "Next", exact: true }).click();

    await page.waitForURL("**/itp/book/form", { timeout: 15000 });
    await page.waitForLoadState("networkidle");

    await itpFillBookingForm(page, {
      firstName: "Calendar",
      lastName: "Test",
      netId: "ct789",
      title: "ITP Calendar Constraints Test",
    });

    await page.getByRole("button", { name: "Submit" }).click();

    await page.waitForURL("**/itp/book/confirmation", { timeout: 15000 });
    const heading = page.getByRole("heading", {
      name: /Yay! We've received your booking request/i,
    });
    await heading.waitFor({ state: "visible", timeout: 30000 });
    await expect(heading).toBeVisible();
  });

  test("should allow booking room 410 when room 408 has existing events", async ({
    page,
  }) => {
    await registerItpBookingMocks(page);

    // Only room 408 has events, room 410 is free
    const mockEvents = createItpMockCalendarEvents();
    await page.route("**/api/calendarEvents**", (route) => {
      const url = new URL(route.request().url());
      const calendarIds = url.searchParams.get("calendarIds");
      if (calendarIds) {
        const grouped: Record<string, any[]> = {};
        for (const id of calendarIds.split(",")) {
          grouped[id] = id === "mock-calendar-408" ? mockEvents : [];
        }
        return route.fulfill({
          status: 200,
          headers: { "content-type": "application/json" },
          body: JSON.stringify(grouped),
        });
      }
      return route.fulfill({
        status: 200,
        headers: { "content-type": "application/json" },
        body: JSON.stringify([]),
      });
    });

    await itpNavigateToRoleSelection(page);

    await itpSelectRole(page, { roleIndex: 1 });
    await page.getByRole("button", { name: "Next", exact: true }).click();

    // Book room 410 (should have no conflicts)
    await page.waitForURL("**/itp/book/selectRoom", { timeout: 15000 });
    await itpSelectTimeSlot(page, "410");
    await page.waitForTimeout(500);
    await page.getByRole("button", { name: "Next", exact: true }).click();

    await page.waitForURL("**/itp/book/form", { timeout: 15000 });
    await page.waitForLoadState("networkidle");

    await itpFillBookingForm(page, {
      firstName: "Room410",
      lastName: "Test",
      netId: "r410",
      title: "ITP Room 410 Test",
    });

    await page.getByRole("button", { name: "Submit" }).click();

    await page.waitForURL("**/itp/book/confirmation", { timeout: 15000 });
    const heading = page.getByRole("heading", {
      name: /Yay! We've received your booking request/i,
    });
    await heading.waitFor({ state: "visible", timeout: 30000 });
    await expect(heading).toBeVisible();
  });
});
