import { expect, test, type Page } from "@playwright/test";
import { registerBookingMocks } from "./helpers/mock-routes";
import { selectRole } from "./helpers/test-utils";

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";

const DAY_MS = 24 * 60 * 60 * 1000;
// The client asks for the viewed month ± 1 week: at most 31 + 14 days.
const MAX_WINDOW_DAYS = 46;

/**
 * Record every GET the client sends to /api/calendarEvents while answering
 * with an empty calendar. The route is mocked in every e2e suite, so the
 * request itself (range, fresh flag, how often it fires) is the only place the
 * client's fetching behaviour can be observed.
 */
async function recordCalendarEventRequests(page: Page) {
  const requests: URL[] = [];
  await page.route("**/api/calendarEvents**", (route) => {
    if (route.request().method() !== "GET") return route.fallback();
    const url = new URL(route.request().url());
    requests.push(url);
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

const windowOf = (url: URL) => {
  const start = new Date(url.searchParams.get("start") ?? "");
  const end = new Date(url.searchParams.get("end") ?? "");
  return { start, end, days: (end.getTime() - start.getTime()) / DAY_MS };
};

const covers = (url: URL, date: Date) => {
  const { start, end } = windowOf(url);
  return start.getTime() <= date.getTime() && date.getTime() <= end.getTime();
};

async function goToSelectRoom(page: Page) {
  await page.goto(`${BASE_URL}/mc`, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle");

  const requestBtn = page.getByRole("button", {
    name: /Request a Reservation/i,
  });
  await requestBtn.waitFor({ state: "visible", timeout: 15000 });
  await requestBtn.click();

  await page.waitForURL("**/mc/book", { timeout: 15000 });
  await page.waitForLoadState("networkidle");
  const acceptBtn = page.getByRole("button", { name: /^I accept$/i });
  await acceptBtn.waitFor({ state: "visible", timeout: 10000 });
  await acceptBtn.click();

  await page.waitForURL("**/mc/book/role", { timeout: 15000 });
  await page.waitForLoadState("networkidle");
  await selectRole(page, { roleIndex: 1 }); // Faculty
  await page.getByRole("button", { name: "Next", exact: true }).click();

  await page.waitForURL("**/mc/book/selectRoom", { timeout: 15000 });
}

async function clickDayInVisibleMonth(page: Page, day: number) {
  const datePicker = page.locator(".MuiDateCalendar-root");
  await datePicker
    .locator(
      ".MuiPickersDay-root:not(.Mui-disabled):not(.MuiPickersDay-dayOutsideMonth)",
    )
    .filter({ hasText: new RegExp(`^${day}$`) })
    .first()
    .click();
}

test.describe("Calendar events fetch window", () => {
  test("requests only a window around the current month, then bypasses the cache when a booking starts", async ({
    page,
  }) => {
    await registerBookingMocks(page);
    const requests = await recordCalendarEventRequests(page);

    await page.goto(`${BASE_URL}/mc`, { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle");

    await expect.poll(() => requests.length).toBeGreaterThan(0);
    const now = new Date();
    for (const url of requests) {
      const { days } = windowOf(url);
      expect(days).toBeGreaterThan(0);
      expect(days).toBeLessThanOrEqual(MAX_WINDOW_DAYS);
      expect(covers(url, now)).toBe(true);
      expect(url.searchParams.get("fresh")).toBeNull();
    }

    const requestBtn = page.getByRole("button", {
      name: /Request a Reservation/i,
    });
    await requestBtn.waitFor({ state: "visible", timeout: 15000 });
    await requestBtn.click();

    await expect
      .poll(() => requests.some((u) => u.searchParams.get("fresh") === "1"))
      .toBe(true);
  });

  test("refetches when the viewed month changes, but not when the day changes within it", async ({
    page,
  }) => {
    await registerBookingMocks(page);
    const requests = await recordCalendarEventRequests(page);

    await goToSelectRoom(page);

    const roomCheckbox = page.getByTestId("room-option-202");
    await roomCheckbox.waitFor({ state: "visible", timeout: 15000 });
    await roomCheckbox.check();

    const datePicker = page.locator(".MuiDateCalendar-root");
    await datePicker.waitFor({ state: "visible", timeout: 10000 });

    // The 15th of next month is outside the current month's ± 1 week window.
    const today = new Date();
    const target = new Date(today.getFullYear(), today.getMonth() + 1, 15, 12);
    expect(requests.some((u) => covers(u, target))).toBe(false);

    await datePicker.getByRole("button", { name: "Next month" }).click();
    const monthName = target.toLocaleString("en-US", { month: "long" });
    await datePicker.getByText(new RegExp(monthName)).waitFor();
    await clickDayInVisibleMonth(page, 15);

    await expect.poll(() => requests.some((u) => covers(u, target))).toBe(true);
    const nextMonthRequest = requests.find((u) => covers(u, target))!;
    expect(windowOf(nextMonthRequest).days).toBeLessThanOrEqual(
      MAX_WINDOW_DAYS,
    );

    // Same month, different day: already covered by the fetched window.
    await page.waitForTimeout(1000);
    const settled = requests.length;
    await clickDayInVisibleMonth(page, 20);
    await page.waitForTimeout(1500);
    expect(requests.length).toBe(settled);
  });
});
