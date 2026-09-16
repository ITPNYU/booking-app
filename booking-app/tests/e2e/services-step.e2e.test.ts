import { expect, Page, test } from "@playwright/test";
import { mockTenantSchema, registerBookingMocks } from "./helpers/mock-routes";
import {
  fillBookingForm,
  selectRole,
  selectTimeSlot,
} from "./helpers/test-utils";

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";

const jsonHeaders = { "content-type": "application/json" };

/**
 * The default mock rooms offer no services, so the Services step is skipped.
 * This schema gives Lecture Hall 202 a catering section so the step shows.
 */
const schemaWithCatering = {
  ...mockTenantSchema,
  resources: mockTenantSchema.resources.map((resource) =>
    resource.resourceId === "202"
      ? {
          ...resource,
          services: {
            catering: {
              label: "Catering",
              descriptionHtml: "<p>Select if you need catering.</p>",
              chartField: { required: true },
            },
          },
        }
      : resource,
  ),
};

async function walkToDetails(page: Page, roomId = "202") {
  await page.goto(`${BASE_URL}/mc/book`, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle");
  const acceptBtn = page.getByRole("button", { name: /^I accept$/i });
  await acceptBtn.waitFor({ state: "visible", timeout: 10000 });
  await acceptBtn.click();

  await page.waitForURL("**/mc/book/role", { timeout: 15000 });
  await page.waitForLoadState("networkidle");
  await selectRole(page, { roleIndex: 1 });
  await page.getByRole("button", { name: "Next", exact: true }).click();

  await page.waitForURL("**/mc/book/selectRoom", { timeout: 15000 });
  await selectTimeSlot(page, roomId);
  await page.waitForTimeout(500);
  const nextBtn = page.getByRole("button", { name: "Next", exact: true });
  await nextBtn.waitFor({ state: "visible", timeout: 10000 });
  await nextBtn.click();

  await page.waitForURL("**/mc/book/form", { timeout: 15000 });
  await page.waitForLoadState("networkidle");
}

test.describe("Services step", () => {
  test("walks Details → Services → Confirmation when a room offers services", async ({
    page,
  }) => {
    await registerBookingMocks(page);
    // Registered last, so it wins over the default schema route.
    await page.route("**/api/tenantSchema/mc", (route) =>
      route.fulfill({
        status: 200,
        headers: jsonHeaders,
        body: JSON.stringify(schemaWithCatering),
      }),
    );

    await walkToDetails(page);

    // The Stepper lists Services between Details and Confirmation.
    const stepper = page.locator(".MuiStepper-root");
    await expect(stepper).toContainText("Details");
    await expect(stepper).toContainText("Services");
    await expect(stepper).toContainText("Confirmation");

    // Details has a Next button; attestations and Submit live on Services.
    await expect(page.locator("#checklist")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Submit" })).toHaveCount(0);

    // Next is gated by the Details validation: nothing filled, nothing moves.
    await page.getByRole("button", { name: "Next", exact: true }).click();
    expect(page.url()).toContain("/mc/book/form");

    await fillBookingForm(page, { checkAgreements: false });
    await page.getByRole("button", { name: "Next", exact: true }).click();

    // ── Services ──
    await page.waitForURL("**/mc/book/services", { timeout: 15000 });
    await expect(page.getByRole("heading", { name: "Services" })).toBeVisible();
    await expect(page.locator("#checklist")).toBeVisible();

    // Back returns to Details with the answers kept.
    await page.getByRole("button", { name: "Back", exact: true }).click();
    await page.waitForURL("**/mc/book/form", { timeout: 15000 });
    await expect(page.locator('input[name="title"]')).toHaveValue(
      "E2E Test Booking",
    );
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await page.waitForURL("**/mc/book/services", { timeout: 15000 });

    // Submit block: agreements plus Submit.
    await page.locator("#checklist").check();
    await page.locator("#resetRoom").check();
    await page.locator("#bookingPolicy").check();
    const submitBtn = page.getByRole("button", { name: "Submit" });
    await expect(submitBtn).toBeEnabled({ timeout: 10000 });
    await submitBtn.click();

    // ── Confirmation ──
    await page.waitForURL("**/mc/book/confirmation", { timeout: 15000 });
    const heading = page.getByRole("heading", {
      name: /Yay! We've received your booking request/i,
    });
    await heading.waitFor({ state: "visible", timeout: 30000 });
    await expect(heading).toBeVisible();
  });

  test("skips Services and keeps Submit on Details when no section would show", async ({
    page,
  }) => {
    await registerBookingMocks(page);

    await walkToDetails(page);

    const stepper = page.locator(".MuiStepper-root");
    await expect(stepper).toContainText("Details");
    await expect(stepper).not.toContainText("Services");

    await expect(page.getByRole("button", { name: "Submit" })).toBeVisible();
    await expect(page.locator("#checklist")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Next", exact: true }),
    ).toHaveCount(0);
  });

  test("bounces a direct visit to Services to the earliest incomplete step", async ({
    page,
  }) => {
    await registerBookingMocks(page);

    // Nothing answered yet: affiliation is the first thing missing.
    await page.goto(`${BASE_URL}/mc/book/services`, {
      waitUntil: "domcontentloaded",
    });
    await page.waitForURL("**/mc/book/role", { timeout: 15000 });
  });
});
