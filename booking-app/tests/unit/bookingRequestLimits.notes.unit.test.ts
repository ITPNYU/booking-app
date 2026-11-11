import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockServerFetchAllDataFromCollection = vi.fn();

vi.mock("@/lib/firebase/server/adminDb", () => ({
  serverFetchAllDataFromCollection: (...args: any[]) =>
    mockServerFetchAllDataFromCollection(...args),
}));

vi.mock("firebase-admin/firestore", () => ({
  Timestamp: {
    fromDate: (d: Date) => ({ toMillis: () => d.getTime() }),
  },
}));

import { enforceRequestLimits } from "@/lib/bookingRequestLimits";

const schema = {
  resources: [
    {
      resourceId: "room-1201",
      name: "Room 1201",
      requestLimits: { perSemester: { student: 1 } },
    },
  ],
} as any;

// One existing booking in the window; its history decides whether it counts.
const withHistory = (logs: { status: string; seconds: number }[]) =>
  mockServerFetchAllDataFromCollection.mockImplementation(
    async (tableName: string) =>
      tableName === "bookingLogs"
        ? logs.map((log) => ({
            requestNumber: 7,
            status: log.status,
            changedAt: { seconds: log.seconds },
          }))
        : [
            {
              requestNumber: 7,
              roomIds: ["room-1201"],
              role: "Student",
              requestedAt: {
                toMillis: () => new Date("2026-04-13T10:00:00Z").getTime(),
              },
            },
          ],
  );

const enforce = () =>
  enforceRequestLimits({
    tenant: "mc",
    email: "student@nyu.edu",
    bookingRoleField: "Student",
    limitRoleKey: "student",
    selectedRoomIds: ["room-1201"],
    schema,
  });

describe("request limits ignore history notes", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-13T12:00:00Z"));
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("still frees the slot when a note follows a cancelation", async () => {
    withHistory([
      { status: "REQUESTED", seconds: 100 },
      { status: "CANCELED", seconds: 200 },
      { status: "NOTE", seconds: 300 },
    ]);

    await expect(enforce()).resolves.toEqual({ ok: true });
  });

  it("still counts an active booking that has a note", async () => {
    withHistory([
      { status: "REQUESTED", seconds: 100 },
      { status: "NOTE", seconds: 200 },
    ]);

    await expect(enforce()).resolves.toMatchObject({ ok: false });
  });
});
