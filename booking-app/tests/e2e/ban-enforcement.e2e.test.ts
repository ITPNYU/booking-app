import { expect, test } from "@playwright/test";
import { registerBookingMocks } from "./helpers/mock-routes";
import { registerDefinePropertyInterceptor } from "./helpers/xstate-mocks";
import { selectRole, selectTimeSlot } from "./helpers/test-utils";

const BASE_URL =
  process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";

test.describe("Ban Enforcement – banned user blocked", () => {
  test("blocks banned user from booking", async ({ page }) => {
    await registerBookingMocks(page);
    await registerDefinePropertyInterceptor(page);

    // Inject banned user data for the test user (tf123@nyu.edu)
    await page.addInitScript(() => {
      const makeTimestamp = (d: Date) => ({
        toDate: () => new Date(d),
        toMillis: () => d.getTime(),
        valueOf: () => d.getTime(),
      });

      const mockBannedUsers = [
        {
          id: "ban-1",
          email: "tf123@nyu.edu",
          bannedAt: new Date().toISOString(),
          createdAt: makeTimestamp(new Date()),
        },
      ];

      const original = (window as any).clientFetchAllDataFromCollection;

      (window as any).clientFetchAllDataFromCollection = async function (
        tableName: string,
        constraints: unknown[],
        tenant: string,
      ) {
        const normalized = tableName ? tableName.toLowerCase() : "";
        if (normalized.includes("banned")) {
          return mockBannedUsers;
        }
        if (original) {
          return await original(tableName, constraints, tenant);
        }
        return [];
      };

      const overrideMap: Record<string, Function> = {
        clientFetchAllDataFromCollection:
          (window as any).clientFetchAllDataFromCollection,
      };

      const patchWebpackModules = () => {
        const chunk = (window as any).webpackChunk_N_E;
        if (!chunk) return false;
        let wpRequire: any;
        try {
          chunk.push([
            ["__e2e_ban_" + Date.now()],
            {},
            (req: any) => {
              wpRequire = req;
            },
          ]);
        } catch (_) {
          return false;
        }
        if (!wpRequire?.c) return false;
        let patched = false;
        Object.values(wpRequire.c).forEach((mod: any) => {
          if (
            mod?.exports &&
            typeof mod.exports === "object" &&
            mod.exports !== null
          ) {
            for (const [key, fn] of Object.entries(overrideMap)) {
              if (key in mod.exports && fn) {
                try {
                  Object.defineProperty(mod.exports, key, {
                    value: fn,
                    writable: true,
                    configurable: true,
                    enumerable: true,
                  });
                  patched = true;
                } catch (_) {
                  try {
                    mod.exports[key] = fn;
                    patched = true;
                  } catch (_) {}
                }
              }
            }
          }
        });
        return patched;
      };

      const _earlyPatchId = setInterval(() => {
        try {
          if (patchWebpackModules()) clearInterval(_earlyPatchId);
        } catch (_) {}
      }, 2);
      setTimeout(() => clearInterval(_earlyPatchId), 10000);

      (window as any).__applyMockBookingsOverrides = () => {
        try {
          patchWebpackModules();
        } catch (_) {}
      };
    });

    // Navigate through the booking flow
    await page.goto(`${BASE_URL}/mc`, { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle");

    const requestBtn = page.getByRole("button", {
      name: /Request a Reservation/i,
    });
    await requestBtn.waitFor({ state: "visible", timeout: 15000 });
    await requestBtn.click();

    // Terms
    await page.waitForURL("**/mc/book", { timeout: 15000 });
    await page.waitForLoadState("networkidle");
    await page.getByRole("button", { name: /^I accept$/i }).click();

    // Role selection (Faculty)
    await page.waitForURL("**/mc/book/role", { timeout: 15000 });
    await page.waitForLoadState("networkidle");
    await selectRole(page, { roleIndex: 1 });
    await page.getByRole("button", { name: "Next" }).click();

    // Room & time selection
    await page.waitForURL("**/mc/book/selectRoom", { timeout: 15000 });
    await selectTimeSlot(page, "202");
    await page.waitForTimeout(500);

    // Verify banned alert is shown
    const alert = page.getByRole("alert").filter({
      hasText: /banned from booking/i,
    });
    await alert.waitFor({ state: "visible", timeout: 10000 });
    await expect(alert).toBeVisible();

    // Verify Next button is disabled
    const nextBtn = page.getByRole("button", { name: "Next", exact: true });
    await expect(nextBtn).toBeDisabled();
  });
});
