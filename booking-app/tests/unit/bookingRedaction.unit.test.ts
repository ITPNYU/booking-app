import { beforeEach, describe, expect, it, vi } from "vitest";
import { PagePermission } from "@/components/src/types";
import { TableNames } from "@/components/src/policy";

const mocks = vi.hoisted(() => ({
  mockResolveCallerRole: vi.fn(),
}));

vi.mock("@/lib/api/authz", () => ({
  resolveCallerRole: (...args: unknown[]) =>
    mocks.mockResolveCallerRole(...args),
}));

import {
  STAFF_ONLY_BOOKING_FIELDS,
  canReadStaffOnlyBookingFields,
  redactBookingDocsForCaller,
  stripStaffOnlyBookingFields,
} from "@/lib/api/bookingRedaction";

const session = { email: "alice@nyu.edu", netId: "alice" };
const docs = () => [
  { id: "a", title: "One", memo: "WO-1" },
  { id: "b", title: "Two" },
];

describe("bookingRedaction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lists memo as a staff-only field", () => {
    expect(STAFF_ONLY_BOOKING_FIELDS).toContain("memo");
  });

  it.each([
    [PagePermission.SERVICES, true],
    [PagePermission.ADMIN, true],
    [PagePermission.SUPER_ADMIN, true],
    [PagePermission.BOOKING, false],
    [PagePermission.PA, false],
    [PagePermission.LIAISON, false],
  ])("canReadStaffOnlyBookingFields(%s) is %s", (role, expected) => {
    expect(canReadStaffOnlyBookingFields(role)).toBe(expected);
  });

  it("stripStaffOnlyBookingFields removes memo without mutating the input", () => {
    const input = { id: "a", title: "One", memo: "WO-1" };
    const out = stripStaffOnlyBookingFields(input);
    expect(out).toEqual({ id: "a", title: "One" });
    expect(input.memo).toBe("WO-1");
  });

  it("stripStaffOnlyBookingFields returns the same object when nothing to strip", () => {
    const input = { id: "b", title: "Two" };
    expect(stripStaffOnlyBookingFields(input)).toBe(input);
  });

  it("passes non-booking collections through without a role lookup", async () => {
    const input = docs();
    const out = await redactBookingDocsForCaller(
      session,
      "mc",
      TableNames.BOOKING_LOGS,
      input,
    );
    expect(out).toBe(input);
    expect(mocks.mockResolveCallerRole).not.toHaveBeenCalled();
  });

  it("skips the role lookup for an empty result set", async () => {
    await redactBookingDocsForCaller(session, "mc", TableNames.BOOKING, []);
    expect(mocks.mockResolveCallerRole).not.toHaveBeenCalled();
  });

  it.each([PagePermission.BOOKING, PagePermission.PA, PagePermission.LIAISON])(
    "strips memo from bookings for %s callers",
    async (role) => {
      mocks.mockResolveCallerRole.mockResolvedValue(role);
      const out = await redactBookingDocsForCaller(
        session,
        "mc",
        TableNames.BOOKING,
        docs(),
      );
      expect(mocks.mockResolveCallerRole).toHaveBeenCalledWith(session, "mc");
      expect(out).toEqual([
        { id: "a", title: "One" },
        { id: "b", title: "Two" },
      ]);
    },
  );

  it.each([
    PagePermission.SERVICES,
    PagePermission.ADMIN,
    PagePermission.SUPER_ADMIN,
  ])("keeps memo on bookings for %s callers", async (role) => {
    mocks.mockResolveCallerRole.mockResolvedValue(role);
    const input = docs();
    const out = await redactBookingDocsForCaller(
      session,
      "mc",
      TableNames.BOOKING,
      input,
    );
    expect(out).toBe(input);
  });
});
