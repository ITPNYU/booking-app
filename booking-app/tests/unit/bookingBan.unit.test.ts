import { beforeEach, describe, expect, it, vi } from "vitest";

const mockFetch = vi.fn();

vi.mock("@/lib/firebase/server/adminDb", () => ({
  serverFetchAllDataFromCollection: (...args: unknown[]) => mockFetch(...args),
}));

import { TableNames } from "@/components/src/policy";
import { anyRequesterIsBanned, requesterIsBanned } from "@/lib/bookingBan";

describe("requesterIsBanned", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it("does not query when the email is missing", async () => {
    expect(await requesterIsBanned("", "mc")).toBe(false);
    expect(await requesterIsBanned(undefined, "mc")).toBe(false);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("refuses the check when the tenant is missing", async () => {
    expect(await requesterIsBanned("a@nyu.edu")).toBe(true);
    expect(await requesterIsBanned("a@nyu.edu", "  ")).toBe(true);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("is true for a permanent ban and false after a window ends", async () => {
    mockFetch.mockResolvedValueOnce([
      { email: "a@nyu.edu" },
    ]);
    expect(await requesterIsBanned("A@nyu.edu", "mc")).toBe(true);
    expect(mockFetch).toHaveBeenCalledWith(TableNames.BANNED, [], "mc");

    mockFetch.mockResolvedValueOnce([
      {
        email: "a@nyu.edu",
        startsAt: "2020-01-01T00:00:00.000Z",
        endsAt: "2020-01-08T00:00:00.000Z",
      },
    ]);
    expect(await requesterIsBanned("a@nyu.edu", "itp")).toBe(false);
    expect(mockFetch).toHaveBeenLastCalledWith(TableNames.BANNED, [], "itp");
  });

  it("is true while a timed ban is in effect", async () => {
    const start = new Date(Date.now() - 60_000).toISOString();
    const end = new Date(Date.now() + 60_000).toISOString();
    mockFetch.mockResolvedValue([
      { email: "guest@nyu.edu", startsAt: start, endsAt: end },
    ]);
    expect(await requesterIsBanned("guest@nyu.edu", "mc")).toBe(true);
    expect(mockFetch).toHaveBeenCalledWith(TableNames.BANNED, [], "mc");
  });
});

describe("anyRequesterIsBanned", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it("checks each distinct address and stops at the first ban", async () => {
    mockFetch.mockResolvedValue([{ email: "banned@nyu.edu" }]);

    expect(
      await anyRequesterIsBanned(
        ["guest@nyu.edu", "guest@nyu.edu", "banned@nyu.edu"],
        "mc",
      ),
    ).toBe(true);
    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(mockFetch).toHaveBeenCalledWith(TableNames.BANNED, [], "mc");
  });

  it("is false when none of the addresses are banned", async () => {
    mockFetch.mockResolvedValue([]);
    expect(await anyRequesterIsBanned(["guest@nyu.edu", ""], "itp")).toBe(
      false,
    );
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch).toHaveBeenCalledWith(TableNames.BANNED, [], "itp");
  });

  it("refuses when a tenant is not provided", async () => {
    expect(await anyRequesterIsBanned(["guest@nyu.edu"])).toBe(true);
    expect(mockFetch).not.toHaveBeenCalled();
  });
});
