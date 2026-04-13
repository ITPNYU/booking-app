import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/firebase/server/firebaseAdmin", () => ({
  default: {
    app: vi.fn(() => ({ name: "[DEFAULT]" })),
    firestore: { Firestore: class {} },
  },
}));

vi.mock("firebase-admin/firestore", () => ({
  getFirestore: vi.fn(),
}));

import { getFirestore } from "firebase-admin/firestore";
import {
  getFirestoreForEnv,
  getSchemaFromEnv,
  ENVIRONMENTS,
  type Environment,
} from "@/lib/firebase/server/multiDb";

const mockGetFirestore = vi.mocked(getFirestore);

describe("multiDb", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("ENVIRONMENTS", () => {
    it("contains development, staging, and production", () => {
      expect(ENVIRONMENTS).toContain("development");
      expect(ENVIRONMENTS).toContain("staging");
      expect(ENVIRONMENTS).toContain("production");
      expect(ENVIRONMENTS).toHaveLength(3);
    });
  });

  describe("getFirestoreForEnv", () => {
    it("calls getFirestore with (default) for development", () => {
      const fakeDb = {};
      mockGetFirestore.mockReturnValue(fakeDb as any);

      const result = getFirestoreForEnv("development");

      expect(mockGetFirestore).toHaveBeenCalledWith(
        expect.objectContaining({ name: "[DEFAULT]" }),
        "(default)",
      );
      expect(result).toBe(fakeDb);
    });

    it("calls getFirestore with booking-app-prod for production", () => {
      const fakeDb = {};
      mockGetFirestore.mockReturnValue(fakeDb as any);

      const result = getFirestoreForEnv("production");

      expect(mockGetFirestore).toHaveBeenCalledWith(
        expect.anything(),
        "booking-app-prod",
      );
      expect(result).toBe(fakeDb);
    });

    it("calls getFirestore with booking-app-staging for staging", () => {
      const fakeDb = {};
      mockGetFirestore.mockReturnValue(fakeDb as any);

      const result = getFirestoreForEnv("staging");

      expect(mockGetFirestore).toHaveBeenCalledWith(
        expect.anything(),
        "booking-app-staging",
      );
      expect(result).toBe(fakeDb);
    });

    it("throws for unknown environments", () => {
      expect(() => getFirestoreForEnv("invalid" as Environment)).toThrow(
        "Unknown environment",
      );
    });
  });

  describe("getSchemaFromEnv", () => {
    it("returns schema data when document exists", async () => {
      const mockData = { name: "Test", logo: "logo.png" };
      const mockGet = vi.fn().mockResolvedValue({
        exists: true,
        data: () => mockData,
      });
      const mockDoc = vi.fn(() => ({ get: mockGet }));
      const mockCollection = vi.fn(() => ({ doc: mockDoc }));
      mockGetFirestore.mockReturnValue({ collection: mockCollection } as any);

      const result = await getSchemaFromEnv("development", "mc");

      expect(mockCollection).toHaveBeenCalledWith("tenantSchema");
      expect(mockDoc).toHaveBeenCalledWith("mc");
      expect(result).toEqual(mockData);
    });

    it("returns null when document does not exist", async () => {
      const mockGet = vi.fn().mockResolvedValue({ exists: false });
      const mockDoc = vi.fn(() => ({ get: mockGet }));
      const mockCollection = vi.fn(() => ({ doc: mockDoc }));
      mockGetFirestore.mockReturnValue({ collection: mockCollection } as any);

      const result = await getSchemaFromEnv("development", "nonexistent");

      expect(result).toBeNull();
    });
  });
});
