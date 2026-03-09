import { expect, test } from "@playwright/test";
import { registerBookingMocks } from "./helpers/mock-routes";

const jsonHeaders = { "content-type": "application/json" };
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";
const TEST_USER_EMAIL = "test@nyu.edu";

test.describe("Approve/Decline Action Pages", () => {
  test.beforeEach(async ({ page }) => {
    await registerBookingMocks(page);

    // Mock the approve endpoint
    await page.route("**/api/approve", async (route) => {
      if (route.request().method() === "POST") {
        return route.fulfill({
          status: 200,
          headers: jsonHeaders,
          body: JSON.stringify({ message: "Approved successfully" }),
        });
      }
      return route.fulfill({
        status: 405,
        headers: jsonHeaders,
        body: JSON.stringify({ error: "Method Not Allowed" }),
      });
    });

    // Mock the xstate-transition endpoint (used by decline)
    await page.route("**/api/xstate-transition", async (route) => {
      if (route.request().method() === "POST") {
        return route.fulfill({
          status: 200,
          headers: jsonHeaders,
          body: JSON.stringify({ success: true, newState: "Declined" }),
        });
      }
      return route.fulfill({
        status: 405,
        headers: jsonHeaders,
        body: JSON.stringify({ error: "Method Not Allowed" }),
      });
    });

    // Mock booking-logs endpoint (called by decline for history logging)
    await page.route("**/api/booking-logs**", async (route) => {
      await route.fulfill({
        status: 200,
        headers: jsonHeaders,
        body: JSON.stringify({ success: true }),
      });
    });

    // Mock calendarEvents PUT (called by decline for status update)
    await page.route("**/api/calendarEvents**", async (route) => {
      if (route.request().method() === "PUT") {
        return route.fulfill({
          status: 200,
          headers: jsonHeaders,
          body: JSON.stringify({ success: true }),
        });
      }
      return route.fulfill({
        status: 200,
        headers: jsonHeaders,
        body: JSON.stringify([]),
      });
    });
  });

  test("approve page approves a booking successfully", async ({ page }) => {
    const approveRequestPromise = page.waitForRequest(
      (request) =>
        request.url().includes("/api/approve") &&
        request.method() === "POST"
    );

    await page.goto(
      `${BASE_URL}/mc/approve?calendarEventId=mock-approve-test`,
      { waitUntil: "domcontentloaded" }
    );
    await page.waitForLoadState("networkidle");

    const heading = page.getByRole("heading", { name: "Booking Approval" });
    await heading.waitFor({ state: "visible", timeout: 15000 });

    // Verify the event ID is displayed on the page
    await expect(page.getByText("mock-approve-test")).toBeVisible();

    const approveBtn = page.getByRole("button", { name: "Approve Booking" });
    await approveBtn.waitFor({ state: "visible", timeout: 10000 });
    await approveBtn.click();

    const request = await approveRequestPromise;
    const payload = request.postDataJSON();
    expect(payload).toMatchObject({
      id: "mock-approve-test",
      email: TEST_USER_EMAIL,
    });

    // Button should change to "Approved" and become disabled
    await expect(
      page.getByRole("button", { name: "Approved" })
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Approved" })
    ).toBeDisabled();
  });

  test("decline page requires a reason before declining", async ({ page }) => {
    const declineRequestPromise = page.waitForRequest(
      (request) =>
        request.url().includes("/api/xstate-transition") &&
        request.method() === "POST"
    );

    await page.goto(
      `${BASE_URL}/mc/decline?calendarEventId=mock-decline-test`,
      { waitUntil: "domcontentloaded" }
    );
    await page.waitForLoadState("networkidle");

    const heading = page.getByRole("heading", { name: "Booking Decline" });
    await heading.waitFor({ state: "visible", timeout: 15000 });

    // Verify the event ID is displayed on the page
    await expect(page.getByText("mock-decline-test")).toBeVisible();

    // Verify the decline button is disabled when no reason is provided
    const declineBtn = page.getByRole("button", { name: "Decline Booking" });
    await declineBtn.waitFor({ state: "visible", timeout: 10000 });
    await expect(declineBtn).toBeDisabled();

    // Fill in the reason for declining
    const reasonField = page.getByLabel("Reason for Declining");
    await reasonField.fill("Schedule conflict with another event");

    // Button should now be enabled
    await expect(declineBtn).toBeEnabled();
    await declineBtn.click();

    const request = await declineRequestPromise;
    const payload = request.postDataJSON();
    expect(payload).toMatchObject({
      calendarEventId: "mock-decline-test",
      eventType: "decline",
    });

    // Button should change to "Declined"
    await expect(
      page.getByRole("button", { name: "Declined" })
    ).toBeVisible();
  });

  test("approve page shows error when calendarEventId is missing", async ({
    page,
  }) => {
    await page.goto(`${BASE_URL}/mc/approve`, {
      waitUntil: "domcontentloaded",
    });
    await page.waitForLoadState("networkidle");

    const heading = page.getByRole("heading", { name: "Booking Approval" });
    await heading.waitFor({ state: "visible", timeout: 15000 });

    // Verify the missing event ID message is shown
    await expect(
      page.getByText("No calendar event ID provided")
    ).toBeVisible();

    // The approve button should not be present
    await expect(
      page.getByRole("button", { name: "Approve Booking" })
    ).toHaveCount(0);
  });
});
