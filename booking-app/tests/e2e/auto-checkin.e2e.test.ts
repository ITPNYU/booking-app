import { expect, test } from "@playwright/test";

const BASE_URL =
  process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";
const ENDPOINT = `${BASE_URL}/api/bookings/auto-checkin`;
const VALID_TOKEN = "test-cron-secret-for-e2e";

test.describe("Auto-checkin – cron API auth & dry-run", () => {
  test("401 when no auth header", async ({ page }) => {
    const response = await page.request.get(ENDPOINT);
    expect(response.status()).toBe(401);
  });

  test("403 when token is invalid", async ({ page }) => {
    const response = await page.request.get(ENDPOINT, {
      headers: { Authorization: "Bearer wrong-token" },
    });
    expect(response.status()).toBe(403);
  });

  test("200 dry-run with valid token", async ({ page }) => {
    const response = await page.request.get(`${ENDPOINT}?dryRun=true`, {
      headers: { Authorization: `Bearer ${VALID_TOKEN}` },
    });
    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body).toHaveProperty("mode", "dry-run");
  });
});
