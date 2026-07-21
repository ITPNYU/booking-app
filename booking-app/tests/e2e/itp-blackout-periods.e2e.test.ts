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

test.describe("ITP Blackout Periods – booking blocked", () => {
  test("blocks ITP booking when date falls within a blackout period", async ({
    page,
  }) => {
    await registerItpBookingMocks(page);

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const start = new Date(tomorrow);
    start.setHours(0, 0, 0, 0);
    const end = new Date(tomorrow);
    end.setHours(23, 59, 59, 999);

    // Mock blackout period covering tomorrow (all day) for room 408.
    await mockFirestoreListCollections(page, [
      {
        collection: "blackoutPeriods",
        docs: [
          {
            id: "itp-blackout-1",
            name: "ITP Test Blackout",
            startDate: serializedTimestamp(start),
            endDate: serializedTimestamp(end),
            isActive: true,
            roomIds: [408],
            createdAt: serializedTimestamp(new Date()),
          },
        ],
      },
    ]);

    await itpNavigateToRoleSelection(page);

    // Faculty = index 1
    await itpSelectRole(page, { roleIndex: 1 });
    await page.getByRole("button", { name: "Next", exact: true }).click();

    // Room & time selection – select room 408 and tomorrow's timeslot
    await page.waitForURL("**/itp/book/selectRoom", { timeout: 15000 });
    await itpSelectTimeSlot(page, "408");
    await page.waitForTimeout(500);

    // Verify blackout alert is shown
    const alert = page.getByRole("alert").filter({
      hasText: /blackout period/i,
    });
    await alert.waitFor({ state: "visible", timeout: 10000 });
    await expect(alert).toBeVisible();

    // Verify Next button is disabled
    const nextBtn = page.getByRole("button", { name: "Next", exact: true });
    await expect(nextBtn).toBeDisabled();
  });
});
