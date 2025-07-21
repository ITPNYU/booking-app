import { describe, expect, it } from "vitest";
import { BookingOrigin, formatOrigin } from "../../components/src/types";

describe("BookingOrigin enum", () => {
  it("should have correct values", () => {
    expect(BookingOrigin.USER).toBe("user");
    expect(BookingOrigin.ADMIN).toBe("admin");
    expect(BookingOrigin.WALK_IN).toBe("walk-in");
    expect(BookingOrigin.VIP).toBe("vip");
    expect(BookingOrigin.SYSTEM).toBe("system");
  });
});

describe("formatOrigin", () => {
  it("should format known BookingOrigin values", () => {
    expect(formatOrigin(BookingOrigin.USER)).toBe("User");
    expect(formatOrigin(BookingOrigin.ADMIN)).toBe("Admin");
    expect(formatOrigin(BookingOrigin.WALK_IN)).toBe("Walk-In");
    expect(formatOrigin(BookingOrigin.VIP)).toBe("VIP");
    expect(formatOrigin(BookingOrigin.SYSTEM)).toBe("System");
  });

  it("should format string values matching enum", () => {
    expect(formatOrigin("user")).toBe("User");
    expect(formatOrigin("admin")).toBe("Admin");
    expect(formatOrigin("walk-in")).toBe("Walk-In");
    expect(formatOrigin("vip")).toBe("VIP");
    expect(formatOrigin("system")).toBe("System");
  });

  it("should capitalize unknown string values", () => {
    expect(formatOrigin("custom")).toBe("Custom");
    expect(formatOrigin("otherOrigin")).toBe("OtherOrigin");
  });

  it("should return 'User' for undefined or empty", () => {
    expect(formatOrigin(undefined)).toBe("User");
    expect(formatOrigin("")).toBe("User");
  });
});
