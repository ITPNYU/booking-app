import { describe, expect, it } from "vitest";
import { defaultResource } from "@/components/src/client/routes/components/schemaTypes";
import {
  mergeResource,
  plainResourceDefault,
  projectResourceEdits,
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

  it("fills missing hour fields and keeps a room's services object", () => {
    const stored = plainResourceDefault();
    const room = mergeResource(stored, {
      name: "Garage",
      resourceId: "103",
      capacity: 91,
      services: { setup: { label: "Room Setup" } },
    });

    expect(room.maxHour?.student).toBe(stored.maxHour?.student);
    expect(room.services).toEqual({ setup: { label: "Room Setup" } });
  });

  it("writes back only the fields the form changed", () => {
    const stored = plainResourceDefault();
    const original = {
      name: "Garage",
      resourceId: "103",
      capacity: 91,
      maxHour: { student: 4, faculty: 8 },
    } as ReturnType<typeof plainResourceDefault>;
    const initial = mergeResource(stored, original);
    const current = mergeResource(initial, {
      name: "Garage A",
      maxHour: { student: 6 },
    });

    const edited = projectResourceEdits(original, initial, current);

    expect(edited.name).toBe("Garage A");
    expect(edited.resourceId).toBe("103");
    expect(edited.capacity).toBe(91);
    expect(edited.maxHour).toEqual({ student: 6, faculty: 8 });
    expect(edited.requestLimits).toBeUndefined();
    expect(edited.services).toBeUndefined();
  });

  it("leaves the stored resource unchanged when the form is not edited", () => {
    const stored = plainResourceDefault();
    const original = {
      name: "Garage",
      resourceId: "103",
      capacity: 91,
    } as ReturnType<typeof plainResourceDefault>;
    const initial = mergeResource(stored, original);

    expect(projectResourceEdits(original, initial, initial)).toEqual(original);
  });

  it("keeps a legacy services list instead of merging it into an object", () => {
    const room = mergeResource(plainResourceDefault(), {
      services: ["equipment", "setup"],
    });
    expect(room.services).toEqual(["equipment", "setup"]);
  });

  it("rejects empty, comma, and duplicate resource ids", () => {
    expect(resourceIdError("  ", ["room-a"])).toMatch(/required/i);
    expect(resourceIdError("a,b", ["room-a"])).toMatch(/comma/i);
    expect(resourceIdError("room-a", ["room-a"])).toMatch(/already/i);
    expect(resourceIdError("room-b", ["room-a"])).toBeNull();
  });
});
