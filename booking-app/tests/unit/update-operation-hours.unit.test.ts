import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  clientFetchAllDataFromCollection: vi.fn(),
  clientSaveDataToFirestore: vi.fn(),
  clientUpdateDataInFirestore: vi.fn(),
}));

vi.mock("@/lib/firebase/firebase", () => ({
  clientFetchAllDataFromCollection: mocks.clientFetchAllDataFromCollection,
  clientGetDataByCalendarEventId: vi.fn(),
  clientSaveDataToFirestore: mocks.clientSaveDataToFirestore,
  clientUpdateDataInFirestore: mocks.clientUpdateDataInFirestore,
  getPaginatedData: vi.fn(),
}));

vi.mock("@/lib/firebase/client/clientDb", () => ({
  clientUpdateDataByCalendarEventId: vi.fn(),
}));

vi.mock("@/components/src/server/ui", () => ({
  getBookingToolDeployUrl: vi.fn(),
}));

import { updateOperationHours } from "@/components/src/client/adminSettingsClient";
import { TableNames } from "@/components/src/policy";
import { Days } from "@/components/src/types";

describe("updateOperationHours", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("matches legacy numeric operation-hours roomId values by normalized string", async () => {
    mocks.clientFetchAllDataFromCollection.mockResolvedValue([
      {
        id: "existing-id",
        day: Days.Monday,
        open: 9,
        close: 17,
        isClosed: false,
        roomId: 101,
      },
    ]);

    await updateOperationHours(Days.Monday, 10, 18, false, "101");

    expect(mocks.clientUpdateDataInFirestore).toHaveBeenCalledWith(
      TableNames.OPERATION_HOURS,
      "existing-id",
      {
        day: Days.Monday,
        open: 10,
        close: 18,
        isClosed: false,
        roomId: 101,
      },
    );
    expect(mocks.clientSaveDataToFirestore).not.toHaveBeenCalled();
  });

  it("stores new operation-hours roomId values as strings", async () => {
    mocks.clientFetchAllDataFromCollection.mockResolvedValue([]);

    await updateOperationHours(Days.Tuesday, 8, 16, false, 202);

    expect(mocks.clientSaveDataToFirestore).toHaveBeenCalledWith(
      TableNames.OPERATION_HOURS,
      {
        day: Days.Tuesday,
        open: 8,
        close: 16,
        isClosed: false,
        roomId: "202",
      },
    );
  });
});
