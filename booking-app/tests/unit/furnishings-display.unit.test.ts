import {
  formatFurnishingsChartFields,
  formatFurnishingsSummary,
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

  it("formats the summary with rooms and trimmed details", () => {
    expect(
      formatFurnishingsSummary({
        furnishingsByRoom: { "103": "yes", "233": "yes" },
        furnishingsDetails: "  Two extra tables  ",
      }),
    ).toBe("103, 233 — Two extra tables");
    expect(
      formatFurnishingsSummary({ furnishingsByRoom: { "103": "yes" } }),
    ).toBe("103");
    expect(formatFurnishingsSummary({ furnishingsByRoom: {} })).toBeNull();
  });

  it("formats chartfields for requested rooms only", () => {
    expect(
      formatFurnishingsChartFields({
        furnishingsByRoom: { "103": "yes", "233": "no" },
        chartFieldForFurnishingsByRoom: { "103": "CF-103", "233": "CF-233" },
      }),
    ).toBe("103: CF-103");
    expect(
      formatFurnishingsChartFields({
        furnishingsByRoom: { "103": "yes" },
        chartFieldForFurnishingsByRoom: { "103": "  " },
      }),
    ).toBeNull();
  });
});
