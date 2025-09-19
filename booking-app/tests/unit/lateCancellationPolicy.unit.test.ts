import { Timestamp } from "firebase-admin/firestore";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BookingOrigin } from "../../components/src/types";

// Import the functions we want to test
import {
  isLateCancel,
  isPolicyViolation,
} from "../../components/src/server/db";

describe("Late Cancellation Policy", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("isPolicyViolation", () => {
    it("should return false if doc is null", () => {
      expect(isPolicyViolation(null)).toBe(false);
    });

    it("should return false if doc is undefined", () => {
      expect(isPolicyViolation(undefined)).toBe(false);
    });

    it("should return false if startDate is missing", () => {
      const doc = {
        origin: BookingOrigin.USER,
        requestedAt: Timestamp.now(),
      };
      expect(isPolicyViolation(doc)).toBe(false);
    });

    it("should return false if requestedAt is missing", () => {
      const doc = {
        origin: BookingOrigin.USER,
        startDate: Timestamp.now(),
      };
      expect(isPolicyViolation(doc)).toBe(false);
    });

    it("should return false if origin is not USER", () => {
      const doc = {
        origin: BookingOrigin.ADMIN,
        startDate: Timestamp.now(),
        requestedAt: Timestamp.now(),
      };
      expect(isPolicyViolation(doc)).toBe(false);
    });

    it("should return true for valid USER booking", () => {
      const doc = {
        origin: BookingOrigin.USER,
        startDate: Timestamp.now(),
        requestedAt: Timestamp.now(),
      };
      expect(isPolicyViolation(doc)).toBe(true);
    });

    it("should handle different BookingOrigin values correctly", () => {
      const baseDoc = {
        startDate: Timestamp.now(),
        requestedAt: Timestamp.now(),
      };

      // Test all non-USER origins should return false
      const nonUserOrigins = [
        BookingOrigin.ADMIN,
        BookingOrigin.WALK_IN,
        BookingOrigin.VIP,
        BookingOrigin.SYSTEM,
      ];

      nonUserOrigins.forEach((origin) => {
        const doc = { ...baseDoc, origin };
        expect(isPolicyViolation(doc)).toBe(false);
      });

      // Test USER origin should return true
      const userDoc = { ...baseDoc, origin: BookingOrigin.USER };
      expect(isPolicyViolation(userDoc)).toBe(true);
    });
  });

  describe("isLateCancel", () => {
    it("should return false if policy violation check fails", () => {
      const doc = {
        origin: BookingOrigin.ADMIN, // Non-USER origin
        startDate: Timestamp.now(),
        requestedAt: Timestamp.now(),
      };
      expect(isLateCancel(doc)).toBe(false);
    });

    it("should return false if event is more than 24 hours away", () => {
      const now = new Date("2024-01-01T10:00:00Z");
      vi.setSystemTime(now);

      const doc = {
        origin: BookingOrigin.USER,
        startDate: Timestamp.fromDate(new Date("2024-01-03T10:00:00Z")), // 48 hours away
        requestedAt: Timestamp.fromDate(new Date("2023-12-31T10:00:00Z")),
      };

      expect(isLateCancel(doc)).toBe(false);
    });

    it("should return false if within 1 hour grace period of creation", () => {
      const now = new Date("2024-01-01T10:00:00Z");
      vi.setSystemTime(now);

      const doc = {
        origin: BookingOrigin.USER,
        startDate: Timestamp.fromDate(new Date("2024-01-01T11:00:00Z")), // 1 hour away
        requestedAt: Timestamp.fromDate(new Date("2024-01-01T09:30:00Z")), // 30 minutes ago
      };

      expect(isLateCancel(doc)).toBe(false);
    });

    it("should return true when within 24 hours and outside grace period", () => {
      const now = new Date("2024-01-01T10:00:00Z");
      vi.setSystemTime(now);

      const doc = {
        origin: BookingOrigin.USER,
        startDate: Timestamp.fromDate(new Date("2024-01-01T12:00:00Z")), // 2 hours away
        requestedAt: Timestamp.fromDate(new Date("2024-01-01T08:00:00Z")), // 2 hours ago
      };

      expect(isLateCancel(doc)).toBe(true);
    });

    it("should handle edge case: exactly 24 hours away", () => {
      const now = new Date("2024-01-01T10:00:00Z");
      vi.setSystemTime(now);

      const doc = {
        origin: BookingOrigin.USER,
        startDate: Timestamp.fromDate(new Date("2024-01-02T10:00:00Z")), // exactly 24 hours away
        requestedAt: Timestamp.fromDate(new Date("2024-01-01T08:00:00Z")), // 2 hours ago (outside grace period)
      };

      expect(isLateCancel(doc)).toBe(true); // 24時間ちょうどもペナルティ対象
    });

    it("should handle edge case: exactly 1 hour grace period", () => {
      const now = new Date("2024-01-01T10:00:00Z");
      vi.setSystemTime(now);

      const doc = {
        origin: BookingOrigin.USER,
        startDate: Timestamp.fromDate(new Date("2024-01-01T11:00:00Z")), // 1 hour away
        requestedAt: Timestamp.fromDate(new Date("2024-01-01T09:00:00Z")), // exactly 1 hour ago
      };

      expect(isLateCancel(doc)).toBe(false);
    });
  });
});
