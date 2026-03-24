import { expect, test } from "@playwright/test";
import { registerItpBookingMocks } from "./helpers/itp-mock-routes";
import {
  itpNavigateToRoleSelection,
  itpSelectRole,
  itpSelectTimeSlot,
} from "./helpers/itp-test-utils";

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";

test.describe("ITP Form Validation – overlap and duration errors", () => {
  test("shows overlap error when time conflicts with existing ITP reservation", async ({
    page,
  }) => {
    await registerItpBookingMocks(page);

    // Create an overlapping calendar event at 10-11am tomorrow for room 408
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const eventStart = new Date(tomorrow);
    eventStart.setHours(10, 0, 0, 0);
    const eventEnd = new Date(tomorrow);
    eventEnd.setHours(11, 0, 0, 0);

    const overlappingEvents = [
      {
        id: "itp-overlap-event-1",
        calendarEventId: "itp-overlap-event-1",
        title: "Existing ITP Booking",
        start: eventStart.toISOString(),
        end: eventEnd.toISOString(),
        resourceId: "408",
        roomId: 408,
        status: "APPROVED",
      },
    ];

    await page.route("**/api/calendarEvents**", (route) => {
      const url = new URL(route.request().url());
      const calendarIds = url.searchParams.get("calendarIds");
      if (calendarIds) {
        const grouped: Record<string, any[]> = {};
        for (const id of calendarIds.split(",")) {
          grouped[id] = id === "mock-calendar-408" ? overlappingEvents : [];
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
        body: JSON.stringify(overlappingEvents),
      });
    });

    await itpNavigateToRoleSelection(page);

    // Faculty = index 1
    await itpSelectRole(page, { roleIndex: 1 });
    await page.getByRole("button", { name: "Next", exact: true }).click();

    // Room 408 & time – selectTimeSlot picks 10-11am tomorrow
    await page.waitForURL("**/itp/book/selectRoom", { timeout: 15000 });
    await itpSelectTimeSlot(page, "408");
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

  test("shows duration error when Student booking exceeds 1 hour max for room 408", async ({
    page,
  }) => {
    await registerItpBookingMocks(page);

    await itpNavigateToRoleSelection(page);

    // Student = index 0 (maxHour: 1 for room 408)
    await itpSelectRole(page, { roleIndex: 0 });
    await page.getByRole("button", { name: "Next", exact: true }).click();

    // Select room 408 and a 2-hour slot (exceeds student maxHour of 1)
    await page.waitForURL("**/itp/book/selectRoom", { timeout: 15000 });

    const roomCheckbox = page.getByTestId("room-option-408");
    await roomCheckbox.waitFor({ state: "visible", timeout: 15000 });
    await roomCheckbox.check();

    // Navigate to tomorrow
    const today = new Date();
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowDay = tomorrow.getDate().toString();

    const datePicker = page.locator(".MuiDateCalendar-root");
    await datePicker.waitFor({ state: "visible", timeout: 10000 });

    if (tomorrow.getMonth() !== today.getMonth()) {
      await datePicker.getByRole("button", { name: "Next month" }).click();
      const monthName = tomorrow.toLocaleString("en-US", { month: "long" });
      await datePicker.getByText(new RegExp(monthName)).waitFor();
    }

    await datePicker
      .getByRole("gridcell", { name: tomorrowDay, exact: true })
      .first()
      .click();

    // Wait for calendar
    const calendar = page.locator('[data-testid="booking-calendar-wrapper"]');
    await calendar.waitFor({ state: "visible", timeout: 15000 });
    await page.waitForFunction(
      () => {
        const fc = document.querySelector(".fc");
        return fc && fc.querySelector(".fc-timegrid-slot");
      },
      { timeout: 15000 },
    );

    // Select a 2-hour slot (10am-12pm) via FullCalendar API
    await page.evaluate((rid) => {
      const fcEl = document.querySelector(".fc") as any;
      if (!fcEl) throw new Error("No FullCalendar element found");

      const fiberKey = Object.keys(fcEl).find(
        (k) =>
          k.startsWith("__reactFiber$") ||
          k.startsWith("__reactInternalInstance$"),
      );
      if (!fiberKey) throw new Error("No React fiber found");

      let fiber = fcEl[fiberKey];
      let attempts = 0;

      while (fiber && attempts < 50) {
        attempts++;
        if (
          fiber.stateNode &&
          fiber.stateNode !== fcEl &&
          typeof fiber.stateNode.getApi === "function"
        ) {
          const api = fiber.stateNode.getApi();
          const tomorrow = new Date();
          tomorrow.setDate(tomorrow.getDate() + 1);

          const start = new Date(tomorrow);
          start.setHours(10, 0, 0, 0);
          const end = new Date(tomorrow);
          end.setHours(12, 0, 0, 0); // 2 hours

          api.select(start, end, { resourceId: rid });
          return;
        }
        fiber = fiber.return;
      }

      throw new Error("Could not find FullCalendar API");
    }, "408");

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
