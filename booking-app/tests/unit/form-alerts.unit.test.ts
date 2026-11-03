import { describe, expect, it } from "vitest";
import { defaultFormAlerts } from "../../components/src/client/routes/components/schemaTypes";
import {
  formAlertMatches,
  resolveFormAlerts,
} from "../../components/src/client/routes/booking/utils/formAlerts";

const runtime = {
  origin: "user" as const,
  isAutoApproval: true,
  allowStatus: true,
};

describe("resolveFormAlerts", () => {
  it("picks the eligible status alert and stacks notices", () => {
    const resolved = resolveFormAlerts(defaultFormAlerts, runtime);

    expect(resolved.status?.id).toBe("autoApprovalEligible");
    expect(resolved.notices.map((alert) => alert.id)).toEqual([
      "setupBreakdown",
    ]);
  });

  it("hides an alert when its origin is false and does not fall back", () => {
    const resolved = resolveFormAlerts(
      [
        {
          ...defaultFormAlerts[0],
          showInOrigin: { user: true, VIP: false, walkIn: false },
        },
      ],
      { ...runtime, origin: "VIP" },
    );

    expect(resolved.status).toBeUndefined();
    expect(resolved.notices).toEqual([]);
  });

  it("treats a missing origin key as visible", () => {
    const resolved = resolveFormAlerts(
      [
        {
          ...defaultFormAlerts[0],
          showInOrigin: { user: false },
        },
      ],
      { ...runtime, origin: "walkIn" },
    );

    expect(resolved.status?.id).toBe("autoApprovalEligible");
  });

  it("hides status alerts on modification and still shows notices", () => {
    const resolved = resolveFormAlerts(defaultFormAlerts, {
      ...runtime,
      allowStatus: false,
    });

    expect(resolved.status).toBeUndefined();
    expect(resolved.notices).toHaveLength(1);
  });

  it("fails closed on an unknown condition", () => {
    const alert = {
      ...defaultFormAlerts[0],
      when: {
        autoApproval: "eligible" as const,
        page: "selectRoom",
      } as (typeof defaultFormAlerts)[number]["when"],
    };

    expect(formAlertMatches(alert, runtime)).toBe(false);
  });

  it("fails closed on an unknown autoApproval value", () => {
    const alert = {
      ...defaultFormAlerts[0],
      when: { autoApproval: "maybe" as "eligible" },
    };

    expect(formAlertMatches(alert, runtime)).toBe(false);
  });
});
