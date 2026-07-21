import { describe, expect, it } from "vitest";
import {
  DEFAULT_MAINTENANCE_MODE_MESSAGE,
  DEFAULT_MAINTENANCE_MODE_SETTINGS,
  MAINTENANCE_MODE_MESSAGE_MAX_LEN,
  parseMaintenanceModeFromDoc,
} from "@/lib/utils/maintenanceMode";

describe("parseMaintenanceModeFromDoc", () => {
  it("returns disabled defaults when the document has no maintenance mode", () => {
    expect(parseMaintenanceModeFromDoc(undefined)).toEqual(
      DEFAULT_MAINTENANCE_MODE_SETTINGS,
    );
    expect(parseMaintenanceModeFromDoc({})).toEqual(
      DEFAULT_MAINTENANCE_MODE_SETTINGS,
    );
  });

  it("parses enabled state and message", () => {
    expect(
      parseMaintenanceModeFromDoc({
        maintenanceMode: {
          enabled: true,
          message: "Requests are paused.",
        },
      }),
    ).toEqual({
      enabled: true,
      message: "Requests are paused.",
    });
  });

  it("falls back to the default message for blank or invalid messages", () => {
    expect(
      parseMaintenanceModeFromDoc({
        maintenanceMode: { enabled: true, message: "   " },
      }),
    ).toEqual({
      enabled: true,
      message: DEFAULT_MAINTENANCE_MODE_MESSAGE,
    });

    expect(
      parseMaintenanceModeFromDoc({
        maintenanceMode: { enabled: true, message: null },
      }),
    ).toEqual({
      enabled: true,
      message: DEFAULT_MAINTENANCE_MODE_MESSAGE,
    });
  });

  it("caps stored messages to the maximum length", () => {
    const longMessage = "x".repeat(MAINTENANCE_MODE_MESSAGE_MAX_LEN + 1);

    expect(
      parseMaintenanceModeFromDoc({
        maintenanceMode: { enabled: true, message: longMessage },
      }).message,
    ).toHaveLength(MAINTENANCE_MODE_MESSAGE_MAX_LEN);
  });
});
