import { describe, expect, it } from "vitest";

describe("Date Utils", () => {
  describe("formatBookingTime", () => {
    const formatBookingTime = (dateStr: string) => {
      const date = new Date(dateStr);
      return date.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      });
    };

    it("formats morning time correctly", () => {
      expect(formatBookingTime("2024-01-01T10:00:00")).toBe("10:00 AM");
    });

    it("formats afternoon time correctly", () => {
      expect(formatBookingTime("2024-01-01T15:30:00")).toBe("3:30 PM");
    });

    it("formats midnight correctly", () => {
      expect(formatBookingTime("2024-01-01T00:00:00")).toBe("12:00 AM");
    });

    it("formats noon correctly", () => {
      expect(formatBookingTime("2024-01-01T12:00:00")).toBe("12:00 PM");
    });
  });

  describe("calculateDuration", () => {
    const calculateDuration = (startStr: string, endStr: string) => {
      const start = new Date(startStr);
      const end = new Date(endStr);
      const duration = end.getTime() - start.getTime();
      return duration / (1000 * 60 * 60); // Convert to hours
    };

    it("calculates 2 hour duration correctly", () => {
      expect(
        calculateDuration("2024-01-01T10:00:00", "2024-01-01T12:00:00")
      ).toBe(2);
    });

    it("calculates 4.5 hour duration correctly", () => {
      expect(
        calculateDuration("2024-01-01T09:00:00", "2024-01-01T13:30:00")
      ).toBe(4.5);
    });

    it("calculates 30 minute duration correctly", () => {
      expect(
        calculateDuration("2024-01-01T14:00:00", "2024-01-01T14:30:00")
      ).toBe(0.5);
    });

    it("returns 0 for same start and end time", () => {
      expect(
        calculateDuration("2024-01-01T10:00:00", "2024-01-01T10:00:00")
      ).toBe(0);
    });
  });

  describe("isWeekend", () => {
    const isWeekend = (dateStr: string) => {
      const date = new Date(dateStr);
      const day = date.getDay();
      return day === 0 || day === 6; // Sunday = 0, Saturday = 6
    };

    it("identifies Saturday as weekend", () => {
      expect(isWeekend("2024-01-06T10:00:00")).toBe(true); // Saturday
    });

    it("identifies Sunday as weekend", () => {
      expect(isWeekend("2024-01-07T10:00:00")).toBe(true); // Sunday
    });

    it("identifies Monday as weekday", () => {
      expect(isWeekend("2024-01-01T10:00:00")).toBe(false); // Monday
    });

    it("identifies Friday as weekday", () => {
      expect(isWeekend("2024-01-05T10:00:00")).toBe(false); // Friday
    });
  });
});
