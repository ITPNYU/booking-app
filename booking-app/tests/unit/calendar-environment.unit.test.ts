import { afterEach, describe, expect, it, vi } from "vitest";

import { resolveSelectedRoomCalendars } from "@/components/src/utils/resourceServicesUtils";
import {
  applyEnvironmentCalendarIds,
  getEnvironmentCalendarId,
  MissingProductionCalendarError,
} from "@/lib/utils/calendarEnvironment";

describe("applyEnvironmentCalendarIds", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("uses the dev calendar outside production", () => {
    vi.stubEnv("NEXT_PUBLIC_BRANCH_NAME", "development");
    expect(
      applyEnvironmentCalendarIds([
        {
          resourceId: "202",
          calendarId: "default-202",
          calendarIdDev: "dev-202",
          calendarIdProd: "",
        },
      ]),
    ).toEqual([
      {
        resourceId: "202",
        calendarId: "dev-202",
        calendarIdDev: "dev-202",
        calendarIdProd: "",
      },
    ]);
  });

  it("uses each resource's production calendar id", () => {
    vi.stubEnv("NEXT_PUBLIC_BRANCH_NAME", "production");
    expect(
      getEnvironmentCalendarId({
        resourceId: "202",
        calendarId: "default-202",
        calendarIdProd: "prod-202",
      }),
    ).toBe("prod-202");
  });

  it("still fails closed for one resource with no production calendar id", () => {
    vi.stubEnv("NEXT_PUBLIC_BRANCH_NAME", "production");
    expect(() =>
      getEnvironmentCalendarId({
        resourceId: "annex",
        calendarId: "dev-annex",
        calendarIdProd: "  ",
      }),
    ).toThrow(MissingProductionCalendarError);
  });

  it("skips one resource missing calendarIdProd without dropping the rest", () => {
    vi.stubEnv("NEXT_PUBLIC_BRANCH_NAME", "production");
    const error = vi.spyOn(console, "error").mockImplementation(() => {});

    const resolved = applyEnvironmentCalendarIds([
      {
        resourceId: "202",
        name: "Room 202",
        calendarId: "dev-202",
        calendarIdProd: "prod-202",
      },
      {
        resourceId: "annex",
        name: "Unused annex",
        calendarId: "dev-annex",
        calendarIdProd: "",
      },
      {
        resourceId: "203",
        calendarId: "dev-203",
        calendarIdProd: "prod-203",
      },
    ]);

    expect(resolved.map((resource) => resource.resourceId)).toEqual([
      "202",
      "203",
    ]);
    expect(resolved.map((resource) => resource.calendarId)).toEqual([
      "prod-202",
      "prod-203",
    ]);
    expect(error).toHaveBeenCalledWith(
      expect.stringContaining(
        "Production calendar ID not configured for resource annex",
      ),
    );

    expect(
      resolveSelectedRoomCalendars([{ roomId: "202", calendarId: "stale" }], resolved),
    ).toEqual({
      rooms: [{ roomId: "202", calendarId: "prod-202" }],
    });
    expect(
      resolveSelectedRoomCalendars(
        [{ roomId: "annex", calendarId: "stale-annex" }],
        resolved,
      ),
    ).toEqual({ rooms: [], missingRoomId: "annex" });

    error.mockRestore();
  });
});
