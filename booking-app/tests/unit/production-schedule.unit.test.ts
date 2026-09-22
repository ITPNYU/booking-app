import { describe, expect, it } from "vitest";
import {
  getReservationDurationHours,
  isProductionScheduleMissingWhenRequired,
  isProductionScheduleRequired,
} from "../../components/src/client/routes/booking/utils/productionSchedule";
import { coerceTenantSchema } from "../../lib/tenant/coerceTenantSchema";
import {
  defaultProductionSchedule,
  generateDefaultSchema,
} from "../../components/src/client/routes/components/schemaTypes";

describe("isProductionScheduleRequired", () => {
  const start = new Date("2026-09-22T10:00:00.000Z");

  it("is false at exactly the threshold", () => {
    const end = new Date(start.getTime() + 4 * 60 * 60 * 1000);
    expect(isProductionScheduleRequired(start, end, 4)).toBe(false);
  });

  it("is true when duration is strictly greater than the threshold", () => {
    const end = new Date(start.getTime() + 4 * 60 * 60 * 1000 + 1);
    expect(isProductionScheduleRequired(start, end, 4)).toBe(true);
  });

  it("respects a custom requiredAboveHours", () => {
    const end = new Date(start.getTime() + 2 * 60 * 60 * 1000 + 1);
    expect(isProductionScheduleRequired(start, end, 2)).toBe(true);
    expect(isProductionScheduleRequired(start, end, 3)).toBe(false);
  });

  it("returns false for invalid inputs", () => {
    expect(
      isProductionScheduleRequired(start, new Date("invalid"), 4),
    ).toBe(false);
    expect(isProductionScheduleRequired(start, start, Number.NaN)).toBe(false);
  });
});

describe("isProductionScheduleMissingWhenRequired", () => {
  const start = "2026-09-22T10:00:00.000Z";
  const endOver = "2026-09-22T15:00:00.000Z"; // 5h
  const endUnder = "2026-09-22T13:00:00.000Z"; // 3h

  it("is true when enabled, over threshold, and schedule blank", () => {
    expect(
      isProductionScheduleMissingWhenRequired({
        enabled: true,
        requiredAboveHours: 4,
        start,
        end: endOver,
        productionSchedule: "  ",
      }),
    ).toBe(true);
  });

  it("is false when schedule is provided", () => {
    expect(
      isProductionScheduleMissingWhenRequired({
        enabled: true,
        requiredAboveHours: 4,
        start,
        end: endOver,
        productionSchedule: "10am setup",
      }),
    ).toBe(false);
  });

  it("is false when under threshold or disabled", () => {
    expect(
      isProductionScheduleMissingWhenRequired({
        enabled: true,
        requiredAboveHours: 4,
        start,
        end: endUnder,
        productionSchedule: "",
      }),
    ).toBe(false);
    expect(
      isProductionScheduleMissingWhenRequired({
        enabled: false,
        requiredAboveHours: 4,
        start,
        end: endOver,
        productionSchedule: "",
      }),
    ).toBe(false);
  });
});

describe("getReservationDurationHours", () => {
  it("returns duration in hours", () => {
    const start = new Date("2026-09-22T10:00:00.000Z");
    const end = new Date("2026-09-22T14:30:00.000Z");
    expect(getReservationDurationHours(start, end)).toBe(4.5);
  });

  it("returns null when dates are missing", () => {
    expect(getReservationDurationHours(null, new Date())).toBeNull();
  });
});

describe("productionSchedule schema defaults", () => {
  it("enables production schedule for MC and mediaCommons aliases", () => {
    expect(generateDefaultSchema("mc").form.productionSchedule.enabled).toBe(
      true,
    );
    expect(
      generateDefaultSchema("mediaCommons").form.productionSchedule.enabled,
    ).toBe(true);
    expect(
      generateDefaultSchema("mc").form.productionSchedule.requiredAboveHours,
    ).toBe(4);
    expect(generateDefaultSchema("mc").form.productionSchedule.label).toBe(
      defaultProductionSchedule.label,
    );
  });

  it("keeps production schedule disabled for non-MC tenants", () => {
    expect(generateDefaultSchema("itp").form.productionSchedule.enabled).toBe(
      false,
    );
  });

  it("merges partial productionSchedule over defaults via coerce", () => {
    const coerced = coerceTenantSchema(
      {
        form: {
          services: {},
          productionSchedule: { enabled: true, requiredAboveHours: 6 },
        },
      },
      "itp",
    );
    expect(coerced.form.productionSchedule).toMatchObject({
      enabled: true,
      requiredAboveHours: 6,
      label: defaultProductionSchedule.label,
      calendarBannerMessage: defaultProductionSchedule.calendarBannerMessage,
    });
  });
});
