import { TableNames } from "@/components/src/policy";
import {
  clientDeleteDataFromFirestore,
  clientSaveDataToFirestore,
} from "@/lib/firebase/firebase";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockDeleteDoc = vi.fn().mockResolvedValue(undefined);
const mockAddDoc = vi.fn().mockResolvedValue({ id: "new-doc-id" });
const mockDoc = vi.fn((_db, collectionName, docId) => ({
  _collection: collectionName,
  _id: docId,
}));
const mockCollection = vi.fn((_db, collectionName) => ({
  _collection: collectionName,
}));

vi.mock("firebase/firestore", () => ({
  deleteDoc: (...args: any[]) => mockDeleteDoc(...args),
  addDoc: (...args: any[]) => mockAddDoc(...args),
  doc: (...args: any[]) => mockDoc(...args),
  collection: (...args: any[]) => mockCollection(...args),
  getDocs: vi.fn().mockResolvedValue({ docs: [] }),
  getDoc: vi.fn(),
  updateDoc: vi.fn(),
  setDoc: vi.fn(),
  query: vi.fn((ref) => ref),
  where: vi.fn(),
  orderBy: vi.fn(),
  limit: vi.fn(),
  startAfter: vi.fn(),
  Timestamp: {
    now: vi.fn(() => ({ toDate: () => new Date() })),
    fromDate: vi.fn((d: Date) => ({ toDate: () => d })),
  },
}));

vi.mock("@/lib/firebase/firebaseClient", () => ({
  getDb: vi.fn().mockReturnValue({}),
  initializeDb: vi.fn(),
}));

vi.mock("@/components/src/types", async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual };
});
vi.mock("@/components/src/client/routes/components/SchemaProvider", () => ({}));

describe("clientDeleteDataFromFirestore — tenant collection resolution", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("uses the tenant-prefixed collection when the URL contains a tenant segment", async () => {
    vi.stubGlobal("location", { pathname: "/mc/admin/settings/policy" });

    await clientDeleteDataFromFirestore(TableNames.BLACKOUT_PERIODS, "period-1");

    expect(mockDoc).toHaveBeenCalledWith(
      expect.anything(),
      "mc-blackoutPeriods",
      "period-1",
    );
    expect(mockDeleteDoc).toHaveBeenCalledTimes(1);
  });

  it("uses the base collection name for non-tenant-specific collections", async () => {
    vi.stubGlobal("location", { pathname: "/mc/admin/settings/policy" });

    await clientDeleteDataFromFirestore("settings", "settings-1");

    expect(mockDoc).toHaveBeenCalledWith(
      expect.anything(),
      "settings",
      "settings-1",
    );
    expect(mockDeleteDoc).toHaveBeenCalledTimes(1);
  });

  it("uses the base collection name when no tenant is in the URL", async () => {
    vi.stubGlobal("location", { pathname: "/" });

    await clientDeleteDataFromFirestore(TableNames.BLACKOUT_PERIODS, "period-1");

    expect(mockDoc).toHaveBeenCalledWith(
      expect.anything(),
      "blackoutPeriods",
      "period-1",
    );
    expect(mockDeleteDoc).toHaveBeenCalledTimes(1);
  });

  it("respects an explicit tenant argument over the URL", async () => {
    vi.stubGlobal("location", { pathname: "/other/path" });

    await clientDeleteDataFromFirestore(
      TableNames.BLACKOUT_PERIODS,
      "period-1",
      "mc",
    );

    expect(mockDoc).toHaveBeenCalledWith(
      expect.anything(),
      "mc-blackoutPeriods",
      "period-1",
    );
    expect(mockDeleteDoc).toHaveBeenCalledTimes(1);
  });
});

describe("clientSaveDataToFirestore — tenant collection resolution", () => {
  const sampleData = { name: "Winter Break", isActive: true };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("uses the tenant-prefixed collection when the URL contains a tenant segment", async () => {
    vi.stubGlobal("location", { pathname: "/mc/admin/settings/policy" });

    await clientSaveDataToFirestore(TableNames.BLACKOUT_PERIODS, sampleData);

    expect(mockCollection).toHaveBeenCalledWith(
      expect.anything(),
      "mc-blackoutPeriods",
    );
    expect(mockAddDoc).toHaveBeenCalledTimes(1);
  });

  it("uses the base collection name for non-tenant-specific collections", async () => {
    vi.stubGlobal("location", { pathname: "/mc/admin/settings/policy" });

    await clientSaveDataToFirestore("departments", sampleData);

    expect(mockCollection).toHaveBeenCalledWith(
      expect.anything(),
      "departments",
    );
    expect(mockAddDoc).toHaveBeenCalledTimes(1);
  });

  it("uses the base collection name when no tenant is in the URL", async () => {
    vi.stubGlobal("location", { pathname: "/" });

    await clientSaveDataToFirestore(TableNames.BLACKOUT_PERIODS, sampleData);

    expect(mockCollection).toHaveBeenCalledWith(
      expect.anything(),
      "blackoutPeriods",
    );
    expect(mockAddDoc).toHaveBeenCalledTimes(1);
  });

  it("respects an explicit tenant argument over the URL", async () => {
    vi.stubGlobal("location", { pathname: "/other/path" });

    await clientSaveDataToFirestore(
      TableNames.BLACKOUT_PERIODS,
      sampleData,
      "mc",
    );

    expect(mockCollection).toHaveBeenCalledWith(
      expect.anything(),
      "mc-blackoutPeriods",
    );
    expect(mockAddDoc).toHaveBeenCalledTimes(1);
  });
});
