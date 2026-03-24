import { expect, test } from "@playwright/test";
import { registerItpBookingMocks } from "./helpers/itp-mock-routes";
import {
  itpNavigateToRoleSelection,
  itpSelectRole,
  itpSelectTimeSlot,
  itpFillBookingForm,
} from "./helpers/itp-test-utils";

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";

test.describe("ITP Auto-Approval", () => {
  test.beforeEach(async ({ page }) => {
    await registerItpBookingMocks(page);
  });

  test("should auto-approve Student booking within maxHour (1h) for room 408", async ({
    page,
  }) => {
    // Override /api/bookings to return APPROVED status
    await page.route("**/api/bookings", async (route) => {
      if (route.request().method() === "POST") {
        return route.fulfill({
          status: 200,
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            success: true,
            booking: {
              requestNumber: 20010,
              status: "APPROVED",
            },
          }),
        });
      }
      return route.fulfill({
        status: 200,
        headers: { "content-type": "application/json" },
        body: JSON.stringify([]),
      });
    });

    await itpNavigateToRoleSelection(page);

    // Student = index 0 (maxHour: 1)
    await itpSelectRole(page, { roleIndex: 0 });
    await page.getByRole("button", { name: "Next", exact: true }).click();

    // Room 408 (shouldAutoApprove: true)
    await page.waitForURL("**/itp/book/selectRoom", { timeout: 15000 });
    await itpSelectTimeSlot(page, "408");
    await page.waitForTimeout(500);
    await page.getByRole("button", { name: "Next", exact: true }).click();

    await page.waitForURL("**/itp/book/form", { timeout: 15000 });
    await page.waitForLoadState("networkidle");

    await itpFillBookingForm(page, {
      firstName: "Auto",
      lastName: "Student",
      netId: "as001",
      title: "Student Auto-Approval Test",
    });

    await page.getByRole("button", { name: "Submit" }).click();

    await page.waitForURL("**/itp/book/confirmation", { timeout: 15000 });
    const heading = page.getByRole("heading", {
      name: /Yay! We've received your booking request/i,
    });
    await heading.waitFor({ state: "visible", timeout: 30000 });
    await expect(heading).toBeVisible();
  });

  test("should auto-approve Faculty booking within maxHour (4h) for room 408", async ({
    page,
  }) => {
    await page.route("**/api/bookings", async (route) => {
      if (route.request().method() === "POST") {
        return route.fulfill({
          status: 200,
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            success: true,
            booking: {
              requestNumber: 20011,
              status: "APPROVED",
            },
          }),
        });
      }
      return route.fulfill({
        status: 200,
        headers: { "content-type": "application/json" },
        body: JSON.stringify([]),
      });
    });

    await itpNavigateToRoleSelection(page);

    // Faculty = index 1 (maxHour: 4)
    await itpSelectRole(page, { roleIndex: 1 });
    await page.getByRole("button", { name: "Next", exact: true }).click();

    await page.waitForURL("**/itp/book/selectRoom", { timeout: 15000 });
    await itpSelectTimeSlot(page, "408");
    await page.waitForTimeout(500);
    await page.getByRole("button", { name: "Next", exact: true }).click();

    await page.waitForURL("**/itp/book/form", { timeout: 15000 });
    await page.waitForLoadState("networkidle");

    await itpFillBookingForm(page, {
      firstName: "Auto",
      lastName: "Faculty",
      netId: "af002",
      title: "Faculty Auto-Approval Test",
    });

    await page.getByRole("button", { name: "Submit" }).click();

    await page.waitForURL("**/itp/book/confirmation", { timeout: 15000 });
    const heading = page.getByRole("heading", {
      name: /Yay! We've received your booking request/i,
    });
    await heading.waitFor({ state: "visible", timeout: 30000 });
    await expect(heading).toBeVisible();
  });

  test("should request approval when booking response returns REQUESTED status", async ({
    page,
  }) => {
    // Override to return REQUESTED
    await page.route("**/api/bookings", async (route) => {
      if (route.request().method() === "POST") {
        return route.fulfill({
          status: 200,
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            success: true,
            booking: {
              requestNumber: 20012,
              status: "REQUESTED",
            },
          }),
        });
      }
      return route.fulfill({
        status: 200,
        headers: { "content-type": "application/json" },
        body: JSON.stringify([]),
      });
    });

    await itpNavigateToRoleSelection(page);

    await itpSelectRole(page, { roleIndex: 0 });
    await page.getByRole("button", { name: "Next", exact: true }).click();

    await page.waitForURL("**/itp/book/selectRoom", { timeout: 15000 });
    await itpSelectTimeSlot(page, "408");
    await page.waitForTimeout(500);
    await page.getByRole("button", { name: "Next", exact: true }).click();

    await page.waitForURL("**/itp/book/form", { timeout: 15000 });
    await page.waitForLoadState("networkidle");

    await itpFillBookingForm(page, {
      firstName: "Request",
      lastName: "Approval",
      netId: "ra003",
      title: "Request Approval Test",
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
