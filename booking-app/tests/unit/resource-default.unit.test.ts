import { describe, expect, it } from "vitest";
import { defaultResource } from "@/components/src/client/routes/components/schemaTypes";
import {
  plainResourceDefault,
  resourceFromDefault,
  resourceIdError,
} from "@/lib/tenant/resourceDefault";

describe("resource default", () => {
  it("strips array __defaults__ so Firestore can store the object", () => {
    const stored = plainResourceDefault();
    expect(stored.resourceId).toBe("");
    expect(stored.staffingSections).toEqual([]);
    expect(stored.staffingSections).not.toHaveProperty("__defaults__");
    expect(
      (defaultResource.staffingSections as { __defaults__?: unknown }).__defaults__,
    ).toBeDefined();
  });

  it("copies the stored default and overwrites room fields", () => {
    const stored = plainResourceDefault();
    stored.requestLimits = {
      perDay: { admin: 1, faculty: 2, student: 3 },
      perWeek: { admin: -1, faculty: -1, student: -1 },
      perMonth: { admin: -1, faculty: -1, student: -1 },
      perSemester: { admin: -1, faculty: -1, student: -1 },
    };

    const resource = resourceFromDefault(stored, {
      name: "Studio",
      resourceId: " studio ",
      capacity: 12,
      calendarId: "cal",
      calendarIdProd: "cal-prod",
      isEquipment: true,
      isWalkIn: false,
    });

    expect(resource.name).toBe("Studio");
    expect(resource.resourceId).toBe("studio");
    expect(resource.capacity).toBe(12);
    expect(resource.calendarId).toBe("cal");
    expect(resource.calendarIdProd).toBe("cal-prod");
    expect(resource.isEquipment).toBe(true);
    expect(resource.isWalkIn).toBe(false);
    expect(resource.requestLimits?.perDay).toEqual({
      admin: 1,
      faculty: 2,
      student: 3,
    });
  });

  it("rejects empty, comma, and duplicate resource ids", () => {
    expect(resourceIdError("  ", ["room-a"])).toMatch(/required/i);
    expect(resourceIdError("a,b", ["room-a"])).toMatch(/comma/i);
    expect(resourceIdError("room-a", ["room-a"])).toMatch(/already/i);
    expect(resourceIdError("room-b", ["room-a"])).toBeNull();
  });
});
