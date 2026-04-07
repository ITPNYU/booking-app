import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/firebase/server/firebaseAdmin", () => ({
  default: {
    app: vi.fn(),
    initializeApp: vi.fn(),
    firestore: { Firestore: class {} },
  },
}));

import admin from "@/lib/firebase/server/firebaseAdmin";
import {
  getFirestoreForEnv,
  getSchemaFromEnv,
  ENVIRONMENTS,
  type Environment,
} from "@/lib/firebase/server/multiDb";

const mockApp = vi.mocked(admin.app);
const mockInitializeApp = vi.mocked(admin.initializeApp);

function createFakeApp(opts?: { settingsFn?: ReturnType<typeof vi.fn> }) {
  const settingsFn = opts?.settingsFn ?? vi.fn();
  return {
    firestore: () => ({ settings: settingsFn }),
  };
}

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
    it("reuses an existing named app", () => {
      const fakeApp = createFakeApp();
      mockApp.mockReturnValue(fakeApp as any);

      getFirestoreForEnv("development");

      expect(mockApp).toHaveBeenCalledWith("multi-db-development");
      expect(mockInitializeApp).not.toHaveBeenCalled();
    });

    it("creates a new named app when one does not exist", () => {
      const fakeDefaultApp = { options: { projectId: "test" } };
      const fakeNewApp = createFakeApp();

      mockApp
        .mockImplementationOnce(() => {
          throw new Error("does not exist");
        })
        .mockReturnValueOnce(fakeDefaultApp as any);

      mockInitializeApp.mockReturnValue(fakeNewApp as any);

      getFirestoreForEnv("staging");

      expect(mockInitializeApp).toHaveBeenCalledWith(
        fakeDefaultApp.options,
        "multi-db-staging",
      );
    });

    it("applies databaseId settings for non-default databases", () => {
      const settingsFn = vi.fn();
      const fakeApp = createFakeApp({ settingsFn });
      mockApp.mockReturnValue(fakeApp as any);

      getFirestoreForEnv("production");

      expect(settingsFn).toHaveBeenCalledWith({
        databaseId: "booking-app-prod",
      });
    });

    it("skips databaseId settings for the default database", () => {
      const settingsFn = vi.fn();
      const fakeApp = createFakeApp({ settingsFn });
      mockApp.mockReturnValue(fakeApp as any);

      getFirestoreForEnv("development");

      expect(settingsFn).not.toHaveBeenCalled();
    });

    it("handles race condition when another request initializes the app concurrently", () => {
      const fakeDefaultApp = { options: { projectId: "test" } };
      const fakeApp = createFakeApp();

      mockApp
        .mockImplementationOnce(() => {
          throw new Error("does not exist");
        })
        .mockReturnValueOnce(fakeDefaultApp as any)
        .mockReturnValueOnce(fakeApp as any);

      mockInitializeApp.mockImplementation(() => {
        throw new Error('Firebase app named "multi-db-development" already exists');
      });

      const result = getFirestoreForEnv("development");

      expect(result).toBeDefined();
      expect(mockApp).toHaveBeenCalledTimes(3);
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
      const fakeApp = {
        firestore: () => ({ settings: vi.fn(), collection: mockCollection }),
      };
      mockApp.mockReturnValue(fakeApp as any);

      const result = await getSchemaFromEnv("development", "mc");

      expect(mockCollection).toHaveBeenCalledWith("tenantSchema");
      expect(mockDoc).toHaveBeenCalledWith("mc");
      expect(result).toEqual(mockData);
    });

    it("returns null when document does not exist", async () => {
      const mockGet = vi.fn().mockResolvedValue({ exists: false });
      const mockDoc = vi.fn(() => ({ get: mockGet }));
      const mockCollection = vi.fn(() => ({ doc: mockDoc }));
      const fakeApp = {
        firestore: () => ({ settings: vi.fn(), collection: mockCollection }),
      };
      mockApp.mockReturnValue(fakeApp as any);

      const result = await getSchemaFromEnv("development", "nonexistent");

      expect(result).toBeNull();
    });
  });
});
