import {
  formatFurnishingsLines,
  getFurnishingsRequestedRoomIds,
  hasFurnishingsRequest,
} from "@/components/src/utils/furnishingsDisplay";
import { describe, expect, it } from "vitest";

describe("furnishingsDisplay", () => {
  it("lists only rooms whose switch is yes, case-insensitively", () => {
    expect(
      getFurnishingsRequestedRoomIds({
        "103": "Yes",
        "233": "no",
        "1201": "yes",
      }),
    ).toEqual(["103", "1201"]);
    expect(getFurnishingsRequestedRoomIds(undefined)).toEqual([]);
    expect(hasFurnishingsRequest({ furnishingsByRoom: { "103": "no" } })).toBe(
      false,
    );
  });

  it("renders one line per requested room with details and chartfield", () => {
    expect(
      formatFurnishingsLines({
        furnishingsByRoom: { "103": "yes", "202": "yes", "233": "no" },
        furnishingsDetailsByRoom: {
          "103": " Two extra tables ",
          "202": "",
          "233": "ignored",
        },
        chartFieldForFurnishingsByRoom: {
          "103": "12345-12",
          "233": "CF-233",
        },
        furnishingsDetails: "Two extra tables",
      }),
    ).toEqual(["103: Two extra tables (chartfield: 12345-12)", "202: yes"]);
  });

  it("falls back to the joined details for bookings without per-room details", () => {
    expect(
      formatFurnishingsLines({
        furnishingsByRoom: { "103": "yes" },
        furnishingsDetails: "Podium and two chairs",
      }),
    ).toEqual(["103: yes", "Details: Podium and two chairs"]);
    expect(formatFurnishingsLines({ furnishingsByRoom: {} })).toEqual([]);
  });
});
