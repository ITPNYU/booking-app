import { expect, test } from "@playwright/test";
import { registerBookingMocks } from "./helpers/mock-routes";
import {
  selectDropdown,
  selectTimeSlot,
  selectRole,
  fillBookingForm,
} from "./helpers/test-utils";

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";

test.describe("Auto-Approval", () => {
  test.beforeEach(async ({ page }) => {
    await registerBookingMocks(page);
  });

  test("should auto-approve booking for room with shouldAutoApprove", async ({
    page,
  }) => {
    // Override /api/bookings to return APPROVED status for auto-approve rooms
    await page.route("**/api/bookings", async (route) => {
      if (route.request().method() === "POST") {
        const body = route.request().postDataJSON();

        return route.fulfill({
          status: 200,
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            success: true,
            booking: {
              requestNumber: 99999,
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

    await page.getByRole("button", { name: "Next", exact: true }).click();

    // ── 4. Room & time selection (room 202 = shouldAutoApprove: true) ──
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
      firstName: "Auto",
      lastName: "Approved",
      netId: "aa123",
      title: "Auto-Approval Test",
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

  test("should request approval for room without shouldAutoApprove", async ({
    page,
  }) => {
    // Override /api/bookings to return REQUESTED status
    await page.route("**/api/bookings", async (route) => {
      if (route.request().method() === "POST") {
        return route.fulfill({
          status: 200,
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            success: true,
            booking: {
              requestNumber: 88888,
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

    await page.getByRole("button", { name: "Next", exact: true }).click();

    // ── 4. Room & time selection (room 220 = shouldAutoApprove: false) ──
    // Room 220 is walk-in only in schema, but for standard booking we use 202
    // Use room 202 with REQUESTED response to test non-auto-approve path
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
      firstName: "Request",
      lastName: "Approval",
      netId: "ra456",
      title: "Request Approval Test",
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
});
