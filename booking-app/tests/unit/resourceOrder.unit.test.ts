import { describe, expect, it } from "vitest";
import { compareResourceIds } from "../../components/src/utils/resourceOrder";

describe("compareResourceIds", () => {
  it("sorts numeric IDs by value, not character by character", () => {
    expect(["1201", "203", "103", "220"].sort(compareResourceIds)).toEqual([
      "103",
      "203",
      "220",
      "1201",
    ]);
  });

  it("orders a numeric suffix within the same prefix", () => {
    expect(["233B", "233A", "1201", "233"].sort(compareResourceIds)).toEqual([
      "233",
      "233A",
      "233B",
      "1201",
    ]);
  });

  it("accepts numbers and strings interchangeably", () => {
    expect([1201, "203", 103].sort(compareResourceIds)).toEqual([
      103,
      "203",
      1201,
    ]);
    expect(compareResourceIds(203, "203")).toBe(0);
  });

  it("returns a negative, zero, or positive result like a comparator", () => {
    expect(compareResourceIds("203", "1201")).toBeLessThan(0);
    expect(compareResourceIds("1201", "203")).toBeGreaterThan(0);
    expect(compareResourceIds("203", "203")).toBe(0);
  });

  it("sorts object lists by their ID field", () => {
    const rooms = [{ roomId: "1201" }, { roomId: "202" }, { roomId: "1000" }];
    expect(
      rooms
        .sort((a, b) => compareResourceIds(a.roomId, b.roomId))
        .map((room) => room.roomId),
    ).toEqual(["202", "1000", "1201"]);
  });
});
