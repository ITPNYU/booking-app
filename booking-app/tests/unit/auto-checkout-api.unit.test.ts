import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock dependencies first
const mockFirestore = {
  collection: vi.fn(),
  batch: vi.fn(),
};

const mockAdmin = {
  firestore: vi.fn(() => mockFirestore),
};

vi.mock("@/lib/firebase/server/firebaseAdmin", () => ({
  default: mockAdmin,
}));

vi.mock("firebase-admin/firestore", () => ({
  Timestamp: {
    now: vi.fn(() => ({
      toDate: () => new Date("2024-01-01T10:00:00Z"),
      toMillis: () => 1704100800000,
    })),
    fromDate: vi.fn((date: Date) => ({
      toDate: () => date,
      toMillis: () => date.getTime(),
    })),
  },
}));

vi.mock("@/lib/firebase/server/adminDb", () => ({
  logServerBookingChange: vi.fn(),
}));

// Import after mocks
import { GET } from "@/app/api/bookings/auto-checkout/route";

describe("Auto-checkout API Route", () => {
  let mockCollection: any;
  let mockBatch: any;
  let mockDoc: any;
  let mockSnapshot: any;

  beforeEach(() => {
    vi.clearAllMocks();

    process.env.CRON_SECRET = "test-secret";

    mockDoc = {
      id: "booking123",
      data: vi.fn(() => ({
        checkedOutAt: null,
        checkedInAt: { toDate: () => new Date("2024-01-01T09:00:00Z") },
        endDate: {
          toDate: () => new Date("2024-01-01T09:30:00Z"),
          toMillis: () => 1704098200000,
        },
        requestNumber: 123,
        calendarEventId: "event123",
      })),
    };

    mockSnapshot = {
      empty: false,
      forEach: vi.fn((callback) => callback(mockDoc)),
      docs: [mockDoc],
    };

    mockBatch = {
      update: vi.fn(),
      commit: vi.fn(),
    };

    mockCollection = {
      where: vi.fn().mockReturnThis(),
      get: vi.fn().mockResolvedValue(mockSnapshot),
      doc: vi.fn().mockReturnValue(mockDoc),
    };

    mockFirestore.collection.mockReturnValue(mockCollection);
    mockFirestore.batch.mockReturnValue(mockBatch);
  });

  afterEach(() => {
    delete process.env.CRON_SECRET;
  });

  it("should return 500 when CRON_SECRET is not set", async () => {
    delete process.env.CRON_SECRET;

    const request = new NextRequest(
      "http://localhost:3000/api/bookings/auto-checkout",
      {
        headers: { authorization: "Bearer test-secret" },
      }
    );

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.message).toBe("Internal Server Error: Configuration missing");
  });

  it("should return 401 when authorization header is missing", async () => {
    const request = new NextRequest(
      "http://localhost:3000/api/bookings/auto-checkout"
    );

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.message).toBe(
      "Unauthorized: Missing or invalid Authorization header"
    );
  });

  it("should return 403 when token is invalid", async () => {
    const request = new NextRequest(
      "http://localhost:3000/api/bookings/auto-checkout",
      {
        headers: { authorization: "Bearer wrong-token" },
      }
    );

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.message).toBe("Forbidden: Invalid token");
  });

  it("should return 200 when no bookings need auto-checkout", async () => {
    mockSnapshot.empty = true;

    const request = new NextRequest(
      "http://localhost:3000/api/bookings/auto-checkout",
      {
        headers: { authorization: "Bearer test-secret" },
      }
    );

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.message).toBe("No bookings found needing auto-checkout.");
  });

  it("should successfully auto-checkout bookings that meet criteria", async () => {
    vi.setSystemTime(new Date("2024-01-01T10:30:00Z"));

    const request = new NextRequest(
      "http://localhost:3000/api/bookings/auto-checkout",
      {
        headers: { authorization: "Bearer test-secret" },
      }
    );

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.message).toContain("Successfully auto-checked out 1 bookings");
    expect(data.updatedIds).toEqual(["booking123"]);

    expect(mockBatch.update).toHaveBeenCalled();
    expect(mockBatch.commit).toHaveBeenCalled();
  });

  it("should use the correct firebase admin instance", async () => {
    const request = new NextRequest(
      "http://localhost:3000/api/bookings/auto-checkout",
      {
        headers: { authorization: "Bearer test-secret" },
      }
    );

    await GET(request);

    expect(mockAdmin.firestore).toHaveBeenCalled();
    expect(mockFirestore.collection).toHaveBeenCalledWith("bookings");
  });
});
