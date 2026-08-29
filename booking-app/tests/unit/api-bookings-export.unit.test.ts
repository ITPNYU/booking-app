import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const stream = vi.fn();
  const orderBy = vi.fn(() => ({ stream }));
  const where = vi.fn(() => ({ where, orderBy }));
  const collection = vi.fn(() => ({ where }));
  const fromDate = vi.fn((date: Date) => date);

  return { stream, orderBy, where, collection, fromDate };
});

vi.mock("@/lib/firebase/server/firebaseAdmin", () => ({
  default: {
    firestore: Object.assign(
      () => ({ collection: mocks.collection }),
      { Timestamp: { fromDate: mocks.fromDate } },
    ),
  },
}));

vi.mock("@/lib/firebase/server/adminDb", () => ({
  getServerTenantCollection: vi.fn(() => "bookings"),
  serverGetDocumentById: vi.fn(async () => ({ resources: [] })),
}));

import { GET } from "@/app/api/bookings/export/route";

describe("GET /api/bookings/export", () => {
  it("requires a complete, valid date range", async () => {
    const response = await GET(
      new Request("http://localhost/api/bookings/export") as any,
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "A valid startDate and endDate are required.",
    });
    expect(mocks.collection).not.toHaveBeenCalled();
  });

  it("filters booking start dates inclusively in the tenant time zone", async () => {
    mocks.stream.mockReturnValue({ on: vi.fn(), destroy: vi.fn() });

    const response = await GET(
      new Request(
        "http://localhost/api/bookings/export?startDate=2026-04-01&endDate=2026-04-30",
      ) as any,
    );

    expect(response.status).toBe(200);
    expect(mocks.where).toHaveBeenNthCalledWith(
      1,
      "startDate",
      ">=",
      expect.any(Date),
    );
    expect(mocks.where).toHaveBeenNthCalledWith(
      2,
      "startDate",
      "<",
      expect.any(Date),
    );
    expect(mocks.orderBy).toHaveBeenCalledWith("startDate");
  });
});
