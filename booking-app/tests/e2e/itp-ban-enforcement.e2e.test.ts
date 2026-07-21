import { expect, test } from "@playwright/test";
import { registerItpBookingMocks } from "./helpers/itp-mock-routes";
import {
  itpNavigateToRoleSelection,
  itpSelectRole,
  itpSelectTimeSlot,
} from "./helpers/itp-test-utils";
import {
  mockFirestoreListCollections,
  serializedTimestamp,
} from "./helpers/test-utils";

test.describe("ITP Ban Enforcement – banned user blocked", () => {
  test("blocks banned user from booking in ITP", async ({ page }) => {
    await registerItpBookingMocks(page);
    await mockFirestoreListCollections(page, [
      {
        collection: "usersBanned",
        docs: [
          {
            id: "itp-ban-1",
            email: "test@nyu.edu",
            bannedAt: new Date().toISOString(),
            createdAt: serializedTimestamp(new Date()),
          },
        ],
      },
    ]);

    await itpNavigateToRoleSelection(page);

    // Faculty = index 1
    await itpSelectRole(page, { roleIndex: 1 });
    await page.getByRole("button", { name: "Next", exact: true }).click();

    // Room & time selection
    await page.waitForURL("**/itp/book/selectRoom", { timeout: 15000 });
    await itpSelectTimeSlot(page, "408");
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
