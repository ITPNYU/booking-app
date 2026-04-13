import * as admin from "firebase-admin";

// Type for persisted XState data using v5 snapshot
export interface PersistedXStateData {
  snapshot: any; // XState v5 snapshot object
  machineId: string;
  lastTransition: string;
}

export type PreApprovalUpdateData = {
  firstApprovedAt: admin.firestore.Timestamp;
  firstApprovedBy?: string;
  xstateData?: PersistedXStateData;
};
