import { Timestamp } from "firebase-admin/firestore";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BookingOrigin } from "../../components/src/types";

// Mock the Firebase function that's actually called
vi.mock("../../lib/firebase/firebase", () => ({
  clientSaveDataToFirestore: vi.fn(),
}));

// Import the function after mocking
import { checkAndLogLateCancellation } from "../../components/src/server/db";
import { clientSaveDataToFirestore } from "../../lib/firebase/firebase";

// Get the mocked function
const mockClientSaveDataToFirestore = vi.mocked(clientSaveDataToFirestore);

describe("checkAndLogLateCancellation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should return early if doc is null", () => {
    checkAndLogLateCancellation(null, "booking123", "testuser");
    expect(mockClientSaveDataToFirestore).not.toHaveBeenCalled();
  });

  it("should return early if doc is undefined", () => {
    checkAndLogLateCancellation(undefined, "booking123", "testuser");
    expect(mockClientSaveDataToFirestore).not.toHaveBeenCalled();
  });

  it("should return early if origin is not USER", () => {
    const doc = {
      origin: BookingOrigin.ADMIN,
      startDate: Timestamp.now(),
      requestedAt: Timestamp.now(),
    };

    checkAndLogLateCancellation(doc, "booking123", "testuser");
    expect(mockClientSaveDataToFirestore).not.toHaveBeenCalled();
  });

  it("should return early if startDate is missing", () => {
    const doc = {
      origin: BookingOrigin.USER,
      requestedAt: Timestamp.now(),
    };

    checkAndLogLateCancellation(doc, "booking123", "testuser");
    expect(mockClientSaveDataToFirestore).not.toHaveBeenCalled();
  });

  it("should return early if requestedAt is missing", () => {
    const doc = {
      origin: BookingOrigin.USER,
      startDate: Timestamp.now(),
    };

    checkAndLogLateCancellation(doc, "booking123", "testuser");
    expect(mockClientSaveDataToFirestore).not.toHaveBeenCalled();
  });

  it("should return early if event is more than 24 hours away", () => {
    const now = new Date("2024-01-01T10:00:00Z");
    vi.setSystemTime(now);

    const doc = {
      origin: BookingOrigin.USER,
      startDate: Timestamp.fromDate(new Date("2024-01-03T10:00:00Z")), // 48 hours away
      requestedAt: Timestamp.fromDate(new Date("2023-12-31T10:00:00Z")),
    };

    checkAndLogLateCancellation(doc, "booking123", "testuser");
    expect(mockClientSaveDataToFirestore).not.toHaveBeenCalled();
  });

  it("should return early if within 1 hour grace period of creation", () => {
    const now = new Date("2024-01-01T10:00:00Z");
    vi.setSystemTime(now);

    const doc = {
      origin: BookingOrigin.USER,
      startDate: Timestamp.fromDate(new Date("2024-01-01T11:00:00Z")), // 1 hour away (within 24h)
      requestedAt: Timestamp.fromDate(new Date("2024-01-01T09:30:00Z")), // 30 minutes ago (within 1h grace)
    };

    checkAndLogLateCancellation(doc, "booking123", "testuser");
    expect(mockClientSaveDataToFirestore).not.toHaveBeenCalled();
  });

  it("should log late cancellation when within 24 hours and outside grace period", () => {
    const now = new Date("2024-01-01T10:00:00Z");
    vi.setSystemTime(now);
    const mockNowTimestamp = Timestamp.fromDate(now);

    const doc = {
      origin: BookingOrigin.USER,
      startDate: Timestamp.fromDate(new Date("2024-01-01T12:00:00Z")), // 2 hours away (within 24h)
      requestedAt: Timestamp.fromDate(new Date("2024-01-01T08:00:00Z")), // 2 hours ago (outside 1h grace)
    };

    checkAndLogLateCancellation(doc, "booking123", "testuser");

    expect(mockClientSaveDataToFirestore).toHaveBeenCalledWith("preBanLogs", {
      netId: "testuser",
      bookingId: "booking123",
      lateCancelDate: expect.any(Object), // Timestamp object
    });
  });

  it("should handle edge case: exactly 24 hours away", () => {
    const now = new Date("2024-01-01T10:00:00Z");
    vi.setSystemTime(now);

    const doc = {
      origin: BookingOrigin.USER,
      startDate: Timestamp.fromDate(new Date("2024-01-02T10:00:00Z")), // exactly 24 hours away
      requestedAt: Timestamp.fromDate(new Date("2024-01-01T08:00:00Z")),
    };

    checkAndLogLateCancellation(doc, "booking123", "testuser");
    // Should NOT be called because exactly 24 hours should not trigger penalty
    expect(mockClientSaveDataToFirestore).not.toHaveBeenCalled();
  });

  it("should handle edge case: exactly 1 hour grace period", () => {
    const now = new Date("2024-01-01T10:00:00Z");
    vi.setSystemTime(now);

    const doc = {
      origin: BookingOrigin.USER,
      startDate: Timestamp.fromDate(new Date("2024-01-01T11:00:00Z")), // 1 hour away
      requestedAt: Timestamp.fromDate(new Date("2024-01-01T09:00:00Z")), // exactly 1 hour ago
    };

    checkAndLogLateCancellation(doc, "booking123", "testuser");
    expect(mockClientSaveDataToFirestore).not.toHaveBeenCalled();
  });

  it("should handle different BookingOrigin values correctly", () => {
    const now = new Date("2024-01-01T10:00:00Z");
    vi.setSystemTime(now);

    const baseDoc = {
      startDate: Timestamp.fromDate(new Date("2024-01-01T12:00:00Z")),
      requestedAt: Timestamp.fromDate(new Date("2024-01-01T08:00:00Z")),
    };

    // Test all non-USER origins should return early
    const nonUserOrigins = [
      BookingOrigin.ADMIN,
      BookingOrigin.WALK_IN,
      BookingOrigin.VIP,
      BookingOrigin.SYSTEM,
    ];

    nonUserOrigins.forEach((origin) => {
      const doc = { ...baseDoc, origin };
      checkAndLogLateCancellation(doc, "booking123", "testuser");
      expect(mockClientSaveDataToFirestore).not.toHaveBeenCalled();
      vi.clearAllMocks();
    });

    // Test USER origin should proceed
    const userDoc = { ...baseDoc, origin: BookingOrigin.USER };
    checkAndLogLateCancellation(userDoc, "booking123", "testuser");
    expect(mockClientSaveDataToFirestore).toHaveBeenCalled();
  });
});
