import { expect, test, type Page } from "@playwright/test";
import { registerBookingMocks } from "./helpers/mock-routes";

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";

/**
 * Count the GETs the client sends to /api/calendarEvents. The booking provider
 * is mounted on the tenant root and the booking-table pages too, but only the
 * booking flows render the room calendar, so only they should fetch it.
 */
async function recordCalendarEventRequests(page: Page) {
  const requests: string[] = [];
  await page.route("**/api/calendarEvents**", (route) => {
    if (route.request().method() !== "GET") return route.fallback();
    const url = new URL(route.request().url());
    requests.push(url.pathname + url.search);
    const grouped: Record<string, any[]> = {};
    for (const id of (url.searchParams.get("calendarIds") ?? "").split(",")) {
      if (id) grouped[id] = [];
    }
    return route.fulfill({
      status: 200,
      headers: { "content-type": "application/json" },
      body: JSON.stringify(grouped),
    });
  });
  return requests;
}

test.describe("Calendar events are fetched only inside booking flows", () => {
  test("tenant root does not fetch; entering the booking flow does", async ({
    page,
  }) => {
    await registerBookingMocks(page);
    const requests = await recordCalendarEventRequests(page);

    await page.goto(`${BASE_URL}/mc`, { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle");
    const requestBtn = page.getByRole("button", {
      name: /Request a Reservation/i,
    });
    await requestBtn.waitFor({ state: "visible", timeout: 15000 });
    await page.waitForTimeout(1000);
    expect(requests).toHaveLength(0);

    await requestBtn.click();
    await page.waitForURL("**/mc/book", { timeout: 15000 });

    await expect.poll(() => requests.length).toBeGreaterThan(0);
  });

  test("admin page does not fetch calendar events", async ({ page }) => {
    await registerBookingMocks(page);
    const requests = await recordCalendarEventRequests(page);

    await page.goto(`${BASE_URL}/mc/admin`, { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1500);

    // Guard against passing vacuously after a redirect away from the page.
    expect(new URL(page.url()).pathname).toContain("/mc/admin");
    expect(requests).toHaveLength(0);
  });
});
