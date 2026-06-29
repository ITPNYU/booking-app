import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_MAINTENANCE_MODE_SETTINGS } from "@/lib/utils/maintenanceMode";

const mocks = vi.hoisted(() => {
  const mockGet = vi.fn();
  const mockDoc = vi.fn(() => ({ get: mockGet }));
  const mockCollection = vi.fn(() => ({ doc: mockDoc }));
  return {
    mockCollection,
    mockDoc,
    mockGet,
  };
});

vi.mock("@/lib/firebase/server/firebaseAdmin", () => ({
  default: {
    firestore: () => ({
      collection: (...args: unknown[]) => mocks.mockCollection(...args),
    }),
  },
}));

import { getMaintenanceModeSettings } from "@/lib/maintenanceModeServer";

describe("getMaintenanceModeSettings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns defaults without reading Firestore when tenant is missing", async () => {
    await expect(getMaintenanceModeSettings()).resolves.toEqual(
      DEFAULT_MAINTENANCE_MODE_SETTINGS,
    );

    expect(mocks.mockCollection).not.toHaveBeenCalled();
  });

  it("returns defaults without reading Firestore when tenant is invalid", async () => {
    await expect(getMaintenanceModeSettings("../settings")).resolves.toEqual(
      DEFAULT_MAINTENANCE_MODE_SETTINGS,
    );

    expect(mocks.mockCollection).not.toHaveBeenCalled();
  });

  it("reads tenant-scoped settings for valid tenants", async () => {
    mocks.mockGet.mockResolvedValue({
      exists: true,
      data: () => ({
        maintenanceMode: {
          enabled: true,
          message: "Requests are paused.",
        },
      }),
    });

    await expect(getMaintenanceModeSettings("mc")).resolves.toEqual({
      enabled: true,
      message: "Requests are paused.",
    });

    expect(mocks.mockCollection).toHaveBeenCalledWith("mc-settings");
    expect(mocks.mockDoc).toHaveBeenCalledWith("maintenanceMode");
  });
});
