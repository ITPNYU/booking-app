import { describe, expect, it } from "vitest";
import {
  DEFAULT_BAN_DURATION_MS,
  addBanWindow,
  banWindowStatus,
  findActiveBan,
  isActiveBan,
  parseBanLocal,
} from "@/components/src/utils/banWindow";

const NOW = new Date("2026-06-03T15:00:00.000Z").getTime();

describe("banWindowStatus", () => {
  it("treats a row with no window as a permanent ban", () => {
    expect(banWindowStatus({ email: "a@nyu.edu" }, NOW)).toBe("permanent");
    expect(isActiveBan({ email: "a@nyu.edu" }, NOW)).toBe(true);
  });

  it("is active only inside [start, end)", () => {
    const ban = {
      email: "a@nyu.edu",
      startsAt: "2026-06-01T00:00:00.000Z",
      endsAt: "2026-06-08T00:00:00.000Z",
    };
    expect(banWindowStatus(ban, NOW)).toBe("active");
    expect(isActiveBan(ban, NOW)).toBe(true);
    expect(isActiveBan(ban, new Date("2026-06-01T00:00:00.000Z").getTime())).toBe(
      true,
    );
    expect(isActiveBan(ban, new Date("2026-06-08T00:00:00.000Z").getTime())).toBe(
      false,
    );
  });

  it("marks a future window as upcoming and a past window as expired", () => {
    expect(
      banWindowStatus(
        {
          startsAt: "2026-07-01T00:00:00.000Z",
          endsAt: "2026-07-08T00:00:00.000Z",
        },
        NOW,
      ),
    ).toBe("upcoming");
    expect(
      banWindowStatus(
        {
          startsAt: "2026-05-01T00:00:00.000Z",
          endsAt: "2026-05-08T00:00:00.000Z",
        },
        NOW,
      ),
    ).toBe("expired");
  });

  it("does not ban a row with one bound or an end that is not later", () => {
    expect(
      banWindowStatus({ startsAt: "2026-06-01T00:00:00.000Z" }, NOW),
    ).toBe("invalid");
    expect(
      isActiveBan(
        {
          startsAt: "2026-06-01T00:00:00.000Z",
          endsAt: "2026-06-01T00:00:00.000Z",
        },
        NOW,
      ),
    ).toBe(false);
  });

  it("reads Firestore timestamp shapes", () => {
    const ban = {
      startsAt: { seconds: 1, nanoseconds: 0 },
      endsAt: { toMillis: () => NOW + 1000 },
    };
    expect(isActiveBan(ban, NOW)).toBe(true);
  });
});

describe("findActiveBan", () => {
  it("matches email case-insensitively and prefers a permanent ban", () => {
    const permanent = { email: "A@nyu.edu" };
    const timed = {
      email: "a@nyu.edu",
      startsAt: "2026-06-01T00:00:00.000Z",
      endsAt: "2026-06-08T00:00:00.000Z",
    };
    expect(findActiveBan([timed, permanent], "a@nyu.edu", NOW)).toBe(permanent);
    expect(findActiveBan([timed], "other@nyu.edu", NOW)).toBeUndefined();
    expect(findActiveBan([timed], "  ", NOW)).toBeUndefined();
  });

  it("uses the latest end when several timed bans are active", () => {
    const earlier = {
      email: "a@nyu.edu",
      startsAt: "2026-06-01T00:00:00.000Z",
      endsAt: "2026-06-04T00:00:00.000Z",
    };
    const later = {
      email: "a@nyu.edu",
      startsAt: "2026-06-01T00:00:00.000Z",
      endsAt: "2026-06-10T00:00:00.000Z",
    };
    expect(findActiveBan([earlier, later], "a@nyu.edu", NOW)).toBe(later);
  });
});

describe("addBanWindow", () => {
  it("defaults to one week later in Eastern Time", () => {
    expect(addBanWindow("2026-06-01T10:00")).toBe("2026-06-08T10:00");
    expect(DEFAULT_BAN_DURATION_MS).toBe(7 * 24 * 60 * 60 * 1000);
  });

  it("parses datetime-local values as Eastern Time", () => {
    expect(parseBanLocal("2026-06-01T10:00")?.toISOString()).toBe(
      "2026-06-01T14:00:00.000Z",
    );
    expect(parseBanLocal("")).toBeNull();
  });
});
