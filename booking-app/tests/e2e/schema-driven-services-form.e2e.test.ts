import { expect, test, type Page } from "@playwright/test";
import { registerBookingMocks } from "./helpers/mock-routes";
import {
  fillBookingForm,
  selectRole,
  selectTimeSlot,
} from "./helpers/test-utils";

/**
 * The MC booking form renders its service sections from
 * `tenantSchema.resources[].services` (Firestore is the source of truth; the
 * app no longer seeds them from code). The e2e tenant schema
 * (`lib/utils/testTenantSchema.ts`, injected server-side under BYPASS_AUTH)
 * carries the real MC snapshot for rooms 103, 221, 260, 1201 (+ annex
 * children) and room 202's config under the e2e-only id 2020. These tests
 * check that each room's sections, toggle locks, labels, and submitted values
 * come from that schema.
 */

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";
const VALID_CHARTFIELD = "12345-AB-CDEFG-HIJKL";

/** Resolves with the form data (`body.data`) of the booking POST; the response is mocked. */
function captureBookingPost(page: Page): Promise<Record<string, any>> {
  return new Promise((resolve) => {
    page.route("**/api/bookings", async (route) => {
      if (route.request().method() !== "POST") {
        return route.fulfill({
          status: 200,
          headers: { "content-type": "application/json" },
          body: "[]",
        });
      }
      resolve(route.request().postDataJSON().data);
      return route.fulfill({
        status: 200,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          success: true,
          booking: { requestNumber: 4242, status: "REQUESTED" },
        }),
      });
    });
  });
}

/** Landing → terms → Faculty role → room + time → (optional room-step hook) → form. */
async function goToForm(
  page: Page,
  roomId: string,
  onRoomStep?: () => Promise<void>,
) {
  await page.goto(`${BASE_URL}/mc`, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: /Request a Reservation/i }).click();

  await page.waitForURL("**/mc/book", { timeout: 15000 });
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: /^I accept$/i }).click();

  await page.waitForURL("**/mc/book/role", { timeout: 15000 });
  await page.waitForLoadState("networkidle");
  await selectRole(page, { roleIndex: 1 });
  await page.getByRole("button", { name: "Next", exact: true }).click();

  await page.waitForURL("**/mc/book/selectRoom", { timeout: 15000 });
  await selectTimeSlot(page, roomId);
  if (onRoomStep) await onRoomStep();
  await page.waitForTimeout(300);
  await page.getByRole("button", { name: "Next", exact: true }).click();

  await page.waitForURL("**/mc/book/form", { timeout: 15000 });
  await page.waitForLoadState("networkidle");
  await page
    .getByTestId(`room-services-${roomId}`)
    .waitFor({ state: "visible", timeout: 15000 });
}

async function submitAndWait(page: Page) {
  await page.getByRole("button", { name: "Submit" }).click();
  await page.waitForURL("**/mc/book/confirmation", { timeout: 30000 });
}

const serviceSwitch = (page: Page, key: string, roomId: string) =>
  page.getByTestId(`service-switch-${key}-${roomId}`);

test.describe("Schema-driven MC service sections", () => {
  test.beforeEach(async ({ page }) => {
    await registerBookingMocks(page);
  });

  test("103 renders setup layouts, staffing options and Campus Safety from the schema and submits the chosen values", async ({
    page,
  }) => {
    const posted = captureBookingPost(page);
    await goToForm(page, "103");
    const block = page.getByTestId("room-services-103");

    // Room Setup: toggle "on" → switch is locked on and the layout radios show.
    const setupSwitch = serviceSwitch(page, "setup", "103");
    await expect(setupSwitch).toBeChecked();
    await expect(setupSwitch).toBeDisabled();
    await expect(
      block.getByLabel("Standing Room (no chairs) - 91 Standing"),
    ).toBeChecked();

    // A layout with a chartfield reveals the chartfield input.
    await block.getByLabel("Audience Layout 1 - 44 Seated*").check();
    const setupChart = page.locator("#chart-setup-103");
    await expect(setupChart).toBeVisible();
    await setupChart.fill(VALID_CHARTFIELD);

    // Staffing: toggle "on", V2 option labels, pick a non-default lighting tech.
    await expect(
      block.getByLabel("No Technician / Plug & Play Lighting"),
    ).toBeChecked();
    await expect(
      block.getByLabel("No Technician / Plug & Play AV"),
    ).toBeChecked();
    await block.getByLabel("Lighting Tech - Busking*").check();
    // A non-default staffing choice requires the details field.
    await page
      .locator("#staffingServicesDetails")
      .fill("Busking lighting for the second half of the event");

    // Equipment: toggle "on" → locked on, and its details field is required.
    const equipmentSwitch = serviceSwitch(page, "equipment", "103");
    await expect(equipmentSwitch).toBeChecked();
    await expect(equipmentSwitch).toBeDisabled();
    await page.locator("#equip-details-103").fill("2x wireless handheld mics");

    // Campus Safety: plain optional switch the user controls.
    const securitySwitch = serviceSwitch(page, "security", "103");
    await expect(securitySwitch).toBeEnabled();
    await expect(securitySwitch).not.toBeChecked();

    await fillBookingForm(page, { title: "103 schema services" });
    await submitAndWait(page);

    const body = await posted;
    expect(body.roomSetupByRoom).toMatchObject({ "103": "103_LAYOUT_1" });
    expect(body.chartFieldForRoomSetupByRoom).toMatchObject({
      "103": VALID_CHARTFIELD,
    });
    expect(String(body.staffingServices)).toContain("LIGHTING_TECH_BUSKING");
    expect(String(body.staffingServices)).toContain("AUDIO_TECH_DIY");
    expect(String(body.staffingServices)).not.toContain("LIGHTING_TECH_DIY");
    expect(body.equipmentServicesDetailsByRoom).toMatchObject({
      "103": "2x wireless handheld mics",
    });
  });

  test("221 shows the schema's own Furniture label locked off and offers Equipment as an optional switch with details", async ({
    page,
  }) => {
    const posted = captureBookingPost(page);
    await goToForm(page, "221");
    const block = page.getByTestId("room-services-221");

    // This label exists only in the e2e tenant schema, never in code.
    await expect(block).toContainText("Furniture (from tenant schema)");
    const furnishings = serviceSwitch(page, "furnishings", "221");
    await expect(furnishings).toBeDisabled();
    await expect(furnishings).not.toBeChecked();
    await expect(page.locator("#furn-details-221")).toHaveCount(0);

    const equipment = serviceSwitch(page, "equipment", "221");
    await expect(equipment).toBeEnabled();
    await expect(equipment).not.toBeChecked();
    await equipment.check();
    const details = page.locator("#equip-details-221");
    await expect(details).toBeVisible();
    await details.fill("2x Small Mocap Suits");

    await fillBookingForm(page, { title: "221 schema services" });
    await submitAndWait(page);

    const body = await posted;
    expect(body.furnishingsByRoom).toMatchObject({ "221": "no" });
    expect(body.equipmentServicesDetailsByRoom).toMatchObject({
      "221": "2x Small Mocap Suits",
    });
  });

  test("room with 202's config locks Catering off with the student-lounge note and hides Room Setup from users", async ({
    page,
  }) => {
    await goToForm(page, "2020");
    const block = page.getByTestId("room-services-2020");

    const catering = serviceSwitch(page, "catering", "2020");
    await expect(catering).toBeDisabled();
    await expect(catering).not.toBeChecked();
    await expect(block).toContainText("Food is not permitted inside 202");

    // setup.showInOrigin.user === false → no setup section for a user booking.
    await expect(serviceSwitch(page, "setup", "2020")).toHaveCount(0);
  });

  test("260 renders only the Equipment section", async ({ page }) => {
    await goToForm(page, "260");
    const block = page.getByTestId("room-services-260");

    await expect(serviceSwitch(page, "equipment", "260")).toBeVisible();
    for (const key of [
      "setup",
      "furnishings",
      "catering",
      "cleaning",
      "security",
    ]) {
      await expect(serviceSwitch(page, key, "260")).toHaveCount(0);
    }
    await expect(block).toContainText("Post Lab comes included");
  });

  test("1201 offers its annex rooms on the room step and submits annexByRoom", async ({
    page,
  }) => {
    const posted = captureBookingPost(page);
    await goToForm(page, "1201", async () => {
      const annex = page.getByTestId("annex-options-1201");
      await expect(annex).toBeVisible();
      for (const id of ["1200L-6", "1202", "1204"]) {
        await expect(page.getByTestId(`annex-option-${id}`)).toBeVisible();
      }
      await page.getByTestId("annex-option-1202").check();
    });

    // Setup is locked on; the default layout is passive (no chartfield).
    const block = page.getByTestId("room-services-1201");
    await expect(
      block.getByLabel("Lecture Style (Default) - 84 Seated"),
    ).toBeChecked();

    await fillBookingForm(page, { title: "1201 annex" });
    await submitAndWait(page);

    const body = await posted;
    expect(body.annexByRoom).toMatchObject({ "1201": ["1202"] });
    expect(body.roomSetupByRoom).toMatchObject({ "1201": "1201_LAYOUT_0" });
  });
});
