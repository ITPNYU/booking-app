import { isValidTenant } from "@/components/src/constants/tenants";
import { TableNames, getTenantCollectionName } from "@/components/src/policy";
import admin from "@/lib/firebase/server/firebaseAdmin";
import {
  DEFAULT_MAINTENANCE_MODE_MESSAGE,
  DEFAULT_MAINTENANCE_MODE_SETTINGS,
  MAINTENANCE_MODE_SETTINGS_DOC_ID,
  MaintenanceModeSettings,
  parseMaintenanceModeFromDoc,
} from "@/lib/utils/maintenanceMode";

export async function getMaintenanceModeSettings(
  tenant?: string,
): Promise<MaintenanceModeSettings> {
  if (!tenant || !isValidTenant(tenant)) {
    return DEFAULT_MAINTENANCE_MODE_SETTINGS;
  }

  try {
    const snap = await admin
      .firestore()
      .collection(getTenantCollectionName(TableNames.SETTINGS, tenant))
      .doc(MAINTENANCE_MODE_SETTINGS_DOC_ID)
      .get();

    return snap.exists
      ? parseMaintenanceModeFromDoc(snap.data() as Record<string, unknown>)
      : DEFAULT_MAINTENANCE_MODE_SETTINGS;
  } catch (error) {
    console.error("[maintenanceMode] Failed to read settings:", error);
    return {
      enabled: true,
      message: DEFAULT_MAINTENANCE_MODE_MESSAGE,
    };
  }
}
