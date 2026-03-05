import { describe, expect, it } from "vitest";
import { buildBlockPastTimes } from "@/components/src/client/routes/booking/utils/buildBlockPastTimes";

/**
 * All timestamps use UTC. February 2026 uses EST (UTC-5), so:
 *   Eastern time  = UTC - 5h
 *   e.g. 14:00Z   = 9:00 AM ET
 *        15:15Z   = 10:15 AM ET
 */

const ROOMS_SINGLE = [{ roomId: 1 }];
const ROOMS_MULTI = [{ roomId: 1 }, { roomId: 2 }];

// Feb 18 2026 at various UTC times (EST = UTC-5)
const FEB18_MIDNIGHT_ET = new Date("2026-02-18T05:00:00Z"); // midnight ET on Feb 18
const FEB19_MIDNIGHT_ET = new Date("2026-02-19T05:00:00Z"); // midnight ET on Feb 19

describe("buildBlockPastTimes", () => {
  describe("future dates", () => {
    it("returns empty array when viewing a future date", () => {
      // now = 9:12 AM ET Feb 18; viewing Feb 19
      const now = new Date("2026-02-18T14:12:00Z");
      const result = buildBlockPastTimes(
        ROOMS_SINGLE,
        FEB19_MIDNIGHT_ET,
        "09:00:00",
        15,
        now
      );
      expect(result).toEqual([]);
    });

    it("returns empty array when viewing a date far in the future", () => {
      const now = new Date("2026-02-18T14:00:00Z");
      const futureDate = new Date("2026-03-15T05:00:00Z");
      const result = buildBlockPastTimes(
        ROOMS_SINGLE,
        futureDate,
        "09:00:00",
        15,
        now
      );
      expect(result).toEqual([]);
    });
  });

  describe("current time before or at startHour (today)", () => {
    it("returns empty array when current time is before startHour", () => {
      // now = 8:30 AM ET; aligned to slot so roundedNow = 8:30 AM ET < 9:00 AM startHour
      const now = new Date("2026-02-18T13:30:00Z"); // 8:30 AM ET
      const result = buildBlockPastTimes(
        ROOMS_SINGLE,
        FEB18_MIDNIGHT_ET,
        "09:00:00",
        15,
        now
      );
      expect(result).toEqual([]);
    });

    it("returns empty array when current time rounds up to exactly startHour", () => {
      // now = 8:55 AM ET; rounds up to 9:00 AM ET = blockEnd <= blockStart
      const now = new Date("2026-02-18T13:55:00Z"); // 8:55 AM ET
      const result = buildBlockPastTimes(
        ROOMS_SINGLE,
        FEB18_MIDNIGHT_ET,
        "09:00:00",
        15,
        now
      );
      expect(result).toEqual([]);
    });

    it("returns empty array when current time is exactly at startHour", () => {
      // now = 9:00 AM ET exactly; already on boundary → roundedNow = 9:00 AM ET = blockStart
      const now = new Date("2026-02-18T14:00:00Z"); // 9:00 AM ET
      const result = buildBlockPastTimes(
        ROOMS_SINGLE,
        FEB18_MIDNIGHT_ET,
        "09:00:00",
        15,
        now
      );
      expect(result).toEqual([]);
    });
  });

  describe("blocking past slots today", () => {
    it("blocks from startHour to next slot boundary when mid-slot", () => {
      // now = 9:12 AM ET; rounds up to 9:15 AM ET
      const now = new Date("2026-02-18T14:12:00Z");
      const result = buildBlockPastTimes(
        ROOMS_SINGLE,
        FEB18_MIDNIGHT_ET,
        "09:00:00",
        15,
        now
      );
      expect(result).toHaveLength(1);
      expect(result[0].start).toBe("2026-02-18T14:00:00.000Z"); // 9:00 AM ET
      expect(result[0].end).toBe("2026-02-18T14:15:00.000Z"); // 9:15 AM ET
      expect(result[0].resourceId).toBe("1");
      expect(result[0].id).toBe("1bg");
      expect(result[0].overlap).toBe(false);
      expect(result[0].display).toBe("background");
      expect(result[0].classNames).toContain("disabled");
    });

    it("blocks up to an exact slot boundary when current time is on a boundary", () => {
      // now = 10:15 AM ET exactly on boundary
      const now = new Date("2026-02-18T15:15:00Z");
      const result = buildBlockPastTimes(
        ROOMS_SINGLE,
        FEB18_MIDNIGHT_ET,
        "09:00:00",
        15,
        now
      );
      expect(result).toHaveLength(1);
      expect(result[0].start).toBe("2026-02-18T14:00:00.000Z"); // 9:00 AM ET
      expect(result[0].end).toBe("2026-02-18T15:15:00.000Z"); // 10:15 AM ET
    });

    it("produces one block per room", () => {
      const now = new Date("2026-02-18T14:12:00Z"); // 9:12 AM ET
      const result = buildBlockPastTimes(
        ROOMS_MULTI,
        FEB18_MIDNIGHT_ET,
        "09:00:00",
        15,
        now
      );
      expect(result).toHaveLength(2);
      expect(result[0].resourceId).toBe("1");
      expect(result[1].resourceId).toBe("2");
      // Both blocks share the same start/end
      expect(result[0].start).toBe(result[1].start);
      expect(result[0].end).toBe(result[1].end);
    });

    it("respects a non-default startHour", () => {
      // startHour = 10:00 AM ET; now = 10:07 AM ET → rounds to 10:15 AM ET
      const now = new Date("2026-02-18T15:07:00Z"); // 10:07 AM ET
      const result = buildBlockPastTimes(
        ROOMS_SINGLE,
        FEB18_MIDNIGHT_ET,
        "10:00:00",
        15,
        now
      );
      expect(result).toHaveLength(1);
      expect(result[0].start).toBe("2026-02-18T15:00:00.000Z"); // 10:00 AM ET
      expect(result[0].end).toBe("2026-02-18T15:15:00.000Z"); // 10:15 AM ET
    });

    it("falls back to 09:00:00 when startHour is undefined", () => {
      const now = new Date("2026-02-18T14:05:00Z"); // 9:05 AM ET → rounds to 9:15
      const result = buildBlockPastTimes(
        ROOMS_SINGLE,
        FEB18_MIDNIGHT_ET,
        undefined,
        15,
        now
      );
      expect(result).toHaveLength(1);
      expect(result[0].start).toBe("2026-02-18T14:00:00.000Z"); // 9:00 AM ET
      expect(result[0].end).toBe("2026-02-18T14:15:00.000Z"); // 9:15 AM ET
    });

    it("handles 30-minute slot units", () => {
      // now = 9:10 AM ET; slotUnit = 30 → rounds up to 9:30 AM ET
      const now = new Date("2026-02-18T14:10:00Z");
      const result = buildBlockPastTimes(
        ROOMS_SINGLE,
        FEB18_MIDNIGHT_ET,
        "09:00:00",
        30,
        now
      );
      expect(result).toHaveLength(1);
      expect(result[0].start).toBe("2026-02-18T14:00:00.000Z"); // 9:00 AM ET
      expect(result[0].end).toBe("2026-02-18T14:30:00.000Z"); // 9:30 AM ET
    });
  });

  describe("timezone correctness", () => {
    it("uses Eastern timezone for today check, not browser local timezone", () => {
      // A user whose browser is in PT (UTC-8) picks "Feb 19" from the date picker.
      // Their midnight = 2026-02-19T08:00:00Z = 3:00 AM ET on Feb 19 (still Feb 19 ET).
      // now = 9:12 AM ET on Feb 18 → should NOT produce blocks (viewing future ET date).
      const now = new Date("2026-02-18T14:12:00Z"); // 9:12 AM ET, Feb 18
      const pacificFeb19Midnight = new Date("2026-02-19T08:00:00Z"); // midnight PT = 3 AM ET Feb 19
      const result = buildBlockPastTimes(
        ROOMS_SINGLE,
        pacificFeb19Midnight,
        "09:00:00",
        15,
        now
      );
      expect(result).toEqual([]);
    });

    it("treats today correctly for Pacific timezone browser viewing today", () => {
      // Pacific midnight for Feb 18 = 2026-02-18T08:00:00Z = 3:00 AM ET on Feb 18.
      // now = 9:12 AM ET → should produce blocks.
      const now = new Date("2026-02-18T14:12:00Z"); // 9:12 AM ET
      const pacificFeb18Midnight = new Date("2026-02-18T08:00:00Z"); // 3 AM ET Feb 18
      const result = buildBlockPastTimes(
        ROOMS_SINGLE,
        pacificFeb18Midnight,
        "09:00:00",
        15,
        now
      );
      expect(result).toHaveLength(1);
      expect(result[0].start).toBe("2026-02-18T14:00:00.000Z");
      expect(result[0].end).toBe("2026-02-18T14:15:00.000Z");
    });

    it("block start time is anchored in Eastern timezone regardless of dateView UTC offset", () => {
      // Both a PT and an ET user viewing Feb 18 "today" should get the same
      // block start (9:00 AM ET = 14:00Z) even though their dateView differs.
      const now = new Date("2026-02-18T14:12:00Z");
      const etFeb18Midnight = new Date("2026-02-18T05:00:00Z");
      const ptFeb18Midnight = new Date("2026-02-18T08:00:00Z");

      const etResult = buildBlockPastTimes(
        ROOMS_SINGLE,
        etFeb18Midnight,
        "09:00:00",
        15,
        now
      );
      const ptResult = buildBlockPastTimes(
        ROOMS_SINGLE,
        ptFeb18Midnight,
        "09:00:00",
        15,
        now
      );

      expect(etResult[0].start).toBe(ptResult[0].start);
      expect(etResult[0].end).toBe(ptResult[0].end);
    });
  });
});
