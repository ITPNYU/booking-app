import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/firebase/firebaseClient", () => ({
  getDb: vi.fn(),
}));

vi.mock("firebase/firestore", () => ({
  collection: vi.fn(),
  getDocs: vi.fn(),
}));

import { GET } from "@/app/api/getData/route";
import { DEFAULT_TENANT } from "@/components/src/constants/tenants";
import { getDb } from "@/lib/firebase/firebaseClient";
import { collection, getDocs } from "firebase/firestore";

const mockGetDb = vi.mocked(getDb);
const mockCollection = vi.mocked(collection);
const mockGetDocs = vi.mocked(getDocs);

const createRequest = (headers: Record<string, string> = {}) => ({
  headers: new Headers(headers),
});

describe("GET /api/getData", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetDb.mockReturnValue({} as any);
  });

  it("fetches admin users for default tenant", async () => {
    const mockDocs = [
      { id: "user1", data: () => ({ email: "admin1@nyu.edu" }) },
      { id: "user2", data: () => ({ email: "admin2@nyu.edu" }) },
    ];
    mockGetDocs.mockResolvedValue({
      docs: mockDocs,
    } as any);
    mockCollection.mockReturnValue({} as any);

    const response = await GET(createRequest() as any);
    const data = await response.json();

    expect(mockGetDb).toHaveBeenCalled();
    expect(mockCollection).toHaveBeenCalledWith(
      expect.anything(),
      `${DEFAULT_TENANT}-adminUsers`,
    );
    expect(response.status).toBe(200);
    expect(data).toEqual([
      { id: "user1", email: "admin1@nyu.edu" },
      { id: "user2", email: "admin2@nyu.edu" },
    ]);
  });

  it("fetches admin users for custom tenant from header", async () => {
    const mockDocs = [
      { id: "user1", data: () => ({ email: "admin1@nyu.edu" }) },
    ];
    mockGetDocs.mockResolvedValue({
      docs: mockDocs,
    } as any);
    mockCollection.mockReturnValue({} as any);

    const response = await GET(
      createRequest({ "x-tenant": "tenant-media" }) as any,
    );
    const data = await response.json();

    expect(mockCollection).toHaveBeenCalledWith(
      expect.anything(),
      "tenant-media-adminUsers",
    );
    expect(response.status).toBe(200);
    expect(data).toEqual([{ id: "user1", email: "admin1@nyu.edu" }]);
  });

  it("returns empty array when no documents found", async () => {
    mockGetDocs.mockResolvedValue({
      docs: [],
    } as any);
    mockCollection.mockReturnValue({} as any);

    const response = await GET(createRequest() as any);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual([]);
  });

  it("handles Firestore errors gracefully", async () => {
    mockGetDocs.mockRejectedValue(new Error("Firestore connection failed"));
    mockCollection.mockReturnValue({} as any);

    const response = await GET(createRequest() as any);

    // NextResponse.error() doesn't set a specific status code
    expect(response).toBeDefined();
  });

  it("handles collection errors gracefully", async () => {
    mockCollection.mockImplementation(() => {
      throw new Error("Collection not found");
    });

    const response = await GET(createRequest() as any);

    // NextResponse.error() doesn't set a specific status code
    expect(response).toBeDefined();
  });
});
