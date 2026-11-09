import { beforeEach, describe, expect, it, vi } from "vitest";

const mockGetCalendarClient = vi.fn();
const mockServerGetRoomCalendarIds = vi.fn();

vi.mock("@/lib/calendarEventsCache", () => ({
  invalidateCalendarEventsCache: vi.fn(),
}));

vi.mock("@/lib/tenant/serverGetTenantResources", () => ({
  serverGetTenantResources: vi.fn().mockResolvedValue([]),
}));

vi.mock("@/lib/googleClient", () => ({
  getCalendarClient: mockGetCalendarClient,
}));

vi.mock("@/components/src/server/admin", () => ({
  serverGetRoomCalendarIds: mockServerGetRoomCalendarIds,
}));

const eventWith = (attendees: { email: string }[]) => ({
  data: { attendees },
});

describe("replaceCalendarAttendee", () => {
  const getMock = vi.fn();
  const patchMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockServerGetRoomCalendarIds.mockResolvedValue(["room-cal"]);
    mockGetCalendarClient.mockResolvedValue({
      events: { get: getMock, patch: patchMock },
    });
    patchMock.mockResolvedValue({});
  });

  const run = async (
    overrides: Partial<{
      previousEmail: string;
      newEmail: string;
      keepPreviousAttendee: boolean;
    }> = {},
  ) => {
    const { replaceCalendarAttendee } = await import(
      "@/components/src/server/calendars"
    );
    return replaceCalendarAttendee({
      calendarEventId: "evt-1",
      roomId: "202",
      previousEmail: "old123@nyu.edu",
      newEmail: "new456@nyu.edu",
      tenant: "mc",
      ...overrides,
    });
  };

  it("swaps the old requester for the new one and notifies guests", async () => {
    getMock.mockResolvedValue(
      eventWith([{ email: "room-203@resource" }, { email: "OLD123@nyu.edu" }]),
    );

    await expect(run()).resolves.toBe(true);

    expect(patchMock).toHaveBeenCalledTimes(1);
    const [{ calendarId, eventId, requestBody, sendUpdates }] =
      patchMock.mock.calls[0];
    expect(calendarId).toBe("room-cal");
    expect(eventId).toBe("evt-1");
    expect(sendUpdates).toBe("all");
    expect(requestBody.attendees).toEqual([
      { email: "room-203@resource" },
      { email: "new456@nyu.edu" },
    ]);
  });

  it("leaves a pending booking's event alone when the old requester was never invited", async () => {
    getMock.mockResolvedValue(eventWith([{ email: "room-203@resource" }]));

    await expect(run()).resolves.toBe(false);
    expect(patchMock).not.toHaveBeenCalled();
  });

  it("keeps the old guest when they are also the secondary contact", async () => {
    getMock.mockResolvedValue(eventWith([{ email: "old123@nyu.edu" }]));

    await run({ keepPreviousAttendee: true });

    expect(patchMock.mock.calls[0][0].requestBody.attendees).toEqual([
      { email: "old123@nyu.edu" },
      { email: "new456@nyu.edu" },
    ]);
  });

  it("does not add the new guest twice", async () => {
    getMock.mockResolvedValue(
      eventWith([{ email: "old123@nyu.edu" }, { email: "new456@nyu.edu" }]),
    );

    await run();

    expect(patchMock.mock.calls[0][0].requestBody.attendees).toEqual([
      { email: "new456@nyu.edu" },
    ]);
  });

  it("tolerates a guest room calendar that does not hold the event", async () => {
    mockServerGetRoomCalendarIds.mockResolvedValue(["room-cal", "guest-cal"]);
    getMock.mockImplementation(({ calendarId }: { calendarId: string }) =>
      calendarId === "room-cal"
        ? Promise.resolve(eventWith([{ email: "old123@nyu.edu" }]))
        : Promise.reject(new Error("Not Found")),
    );

    await expect(run()).resolves.toBe(true);
  });

  it("rejects when no room calendar could be read", async () => {
    getMock.mockRejectedValue(new Error("Not Found"));

    await expect(run()).rejects.toThrow(/Not Found/);
  });

  it("rejects when the guest swap could not be saved", async () => {
    getMock.mockResolvedValue(eventWith([{ email: "old123@nyu.edu" }]));
    patchMock.mockRejectedValue(new Error("quota"));

    await expect(run()).rejects.toThrow(/quota/);
  });

  it("rejects when the room has no calendar", async () => {
    mockServerGetRoomCalendarIds.mockResolvedValue([]);

    await expect(run()).rejects.toThrow(/No calendar found/);
  });
});
