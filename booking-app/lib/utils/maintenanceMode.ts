export const MAINTENANCE_MODE_SETTINGS_DOC_ID = "maintenanceMode";

export const MAINTENANCE_MODE_MESSAGE_MAX_LEN = 4000;

export const DEFAULT_MAINTENANCE_MODE_MESSAGE =
  "The booking tool is temporarily not accepting new requests. Please check back later.";

export type MaintenanceModeSettings = {
  enabled: boolean;
  message: string;
};

export const DEFAULT_MAINTENANCE_MODE_SETTINGS: MaintenanceModeSettings = {
  enabled: false,
  message: DEFAULT_MAINTENANCE_MODE_MESSAGE,
};

export function parseMaintenanceModeFromDoc(
  data: Record<string, unknown> | undefined,
): MaintenanceModeSettings {
  const raw = data?.maintenanceMode;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return DEFAULT_MAINTENANCE_MODE_SETTINGS;
  }

  const record = raw as Record<string, unknown>;
  const message =
    typeof record.message === "string"
      ? record.message.slice(0, MAINTENANCE_MODE_MESSAGE_MAX_LEN)
      : DEFAULT_MAINTENANCE_MODE_MESSAGE;

  return {
    enabled: record.enabled === true,
    message: message.trim() || DEFAULT_MAINTENANCE_MODE_MESSAGE,
  };
}
