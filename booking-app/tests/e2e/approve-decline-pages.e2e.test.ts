import { type Page, expect, test } from "@playwright/test";
import { registerBookingMocks } from "./helpers/mock-routes";

const jsonHeaders = { "content-type": "application/json" };
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";
const TEST_USER_EMAIL = "test@nyu.edu";

const APPROVE_EVENT_ID = "mock-approve-test";
const pendingBooking = {
  id: "mock-approve-doc",
  calendarEventId: APPROVE_EVENT_ID,
  requestNumber: 7073,
  title: "Thesis critique",
  firstName: "Ada",
  lastName: "Lovelace",
  email: "requester@nyu.edu",
  roomId: "221",
  startDate: { __ts: Date.parse("2026-10-20T14:00:00Z") },
  endDate: { __ts: Date.parse("2026-10-20T16:00:00Z") },
  firstApprovedAt: { __ts: Date.parse("2026-10-17T12:00:00Z") },
  status: "PRE-APPROVED",
};

/** Make the test user an admin, or nobody special, without /api/permissions. */
const setUsersRights = (page: Page, isAdmin: boolean) =>
  page.addInitScript((admin) => {
    (window as any).__bookingE2EMocks = {
      ...((window as any).__bookingE2EMocks ?? {}),
      usersRights: admin
        ? [{ email: "test@nyu.edu", isAdmin: true, createdAt: "2026-01-01" }]
        : [],
    };
  }, isAdmin);

test.describe("Approve/Decline Action Pages", () => {
  test.beforeEach(async ({ page }) => {
    await registerBookingMocks(page);

    // The approve page loads the booking it was linked to.
    await page.route("**/api/firestore/list", async (route) => {
      const body = route.request().postDataJSON() ?? {};
      const asksForApproveBooking =
        body.collection === "bookings" &&
        (body.where ?? []).some(
          (clause: { field?: string; value?: unknown }) =>
            clause.field === "calendarEventId" &&
            clause.value === APPROVE_EVENT_ID,
        );
      if (!asksForApproveBooking) return route.fallback();
      return route.fulfill({
        status: 200,
        headers: jsonHeaders,
        body: JSON.stringify({ docs: [pendingBooking] }),
      });
    });

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
      const url = new URL(route.request().url());
      const calendarIds = url.searchParams.get("calendarIds");
      if (calendarIds) {
        const grouped: Record<string, any[]> = {};
        for (const id of calendarIds.split(",")) {
          grouped[id] = [];
        }
        return route.fulfill({
          status: 200,
          headers: jsonHeaders,
          body: JSON.stringify(grouped),
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
    await setUsersRights(page, false);
    const approveRequestPromise = page.waitForRequest(
      (request) =>
        request.url().includes("/api/approve") &&
        request.method() === "POST"
    );

    await page.goto(
      `${BASE_URL}/mc/approve?calendarEventId=${APPROVE_EVENT_ID}`,
      { waitUntil: "domcontentloaded" }
    );
    await page.waitForLoadState("networkidle");

    const heading = page.getByRole("heading", { name: "Booking Approval" });
    await heading.waitFor({ state: "visible", timeout: 15000 });

    // The page shows the booking it was linked to
    await expect(page.getByText("Title: Thesis critique")).toBeVisible();
    await expect(page.getByText("Status: PRE-APPROVED")).toBeVisible();

    const approveBtn = page.getByRole("button", { name: "Approve Booking" });
    await approveBtn.waitFor({ state: "visible", timeout: 10000 });
    await approveBtn.click();

    const request = await approveRequestPromise;
    const payload = request.postDataJSON();
    expect(payload).toMatchObject({
      id: APPROVE_EVENT_ID,
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

  test("approve page declines a booking with a reason", async ({ page }) => {
    await setUsersRights(page, false);
    const declineRequestPromise = page.waitForRequest(
      (request) =>
        request.url().includes("/api/xstate-transition") &&
        request.method() === "POST"
    );

    await page.goto(
      `${BASE_URL}/mc/approve?calendarEventId=${APPROVE_EVENT_ID}`,
      { waitUntil: "domcontentloaded" }
    );
    await page.waitForLoadState("networkidle");

    const declineBtn = page.getByRole("button", { name: "Decline Booking" });
    await declineBtn.waitFor({ state: "visible", timeout: 15000 });
    await expect(declineBtn).toBeDisabled();

    await page
      .getByLabel("Reason for declining")
      .fill("Room is closed that week");
    await expect(declineBtn).toBeEnabled();
    await declineBtn.click();

    const request = await declineRequestPromise;
    expect(request.postDataJSON()).toMatchObject({
      calendarEventId: APPROVE_EVENT_ID,
      eventType: "decline",
      reason: "Room is closed that week",
    });

    await expect(page.getByRole("button", { name: "Declined" })).toBeDisabled();
    await expect(
      page.getByRole("button", { name: "Approve Booking" })
    ).toBeDisabled();
  });

  test("approve page sends admins on to the admin page", async ({ page }) => {
    await setUsersRights(page, true);

    await page.goto(
      `${BASE_URL}/mc/approve?calendarEventId=${APPROVE_EVENT_ID}`,
      { waitUntil: "domcontentloaded" }
    );

    await page.waitForURL(
      `**/mc/admin?calendarEventId=${APPROVE_EVENT_ID}`,
      { timeout: 30000 }
    );
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
