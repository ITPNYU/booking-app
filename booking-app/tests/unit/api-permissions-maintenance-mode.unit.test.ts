import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_MAINTENANCE_MODE_SETTINGS } from "@/lib/utils/maintenanceMode";

const mocks = vi.hoisted(() => {
  const mockGetCollection = vi.fn();
  const mockGetDoc = vi.fn();
  const mockDoc = vi.fn(() => ({ get: mockGetDoc }));
  const mockCollection = vi.fn(() => ({
    doc: (...args: unknown[]) => mockDoc(...args),
    get: (...args: unknown[]) => mockGetCollection(...args),
  }));

  return {
    mockCollection,
    mockDoc,
    mockGetCollection,
    mockGetDoc,
    mockRequireSession: vi.fn(),
  };
});

vi.mock("@/lib/api/requireSession", () => ({
  requireSession: () => mocks.mockRequireSession(),
}));

vi.mock("@/lib/firebase/server/firebaseAdmin", () => ({
  default: {
    firestore: () => ({
      collection: (...args: unknown[]) => mocks.mockCollection(...args),
    }),
  },
}));

import { GET } from "@/app/api/permissions/route";

describe("GET /api/permissions maintenance mode defaults", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.mockRequireSession.mockResolvedValue({
      email: "requester@nyu.edu",
      netId: "requester",
    });
    mocks.mockGetCollection.mockResolvedValue({ docs: [] });
    mocks.mockGetDoc.mockResolvedValue({ exists: false });
  });

  it("defaults maintenance mode to disabled when no settings document exists", async () => {
    const req = new NextRequest(
      "http://localhost:3000/api/permissions?tenant=mc",
    );

    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.maintenanceMode).toEqual(DEFAULT_MAINTENANCE_MODE_SETTINGS);
  });
});
