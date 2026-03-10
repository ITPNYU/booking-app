// Barrel file - re-exports from split modules for backward compatibility.
// Consumers can import directly from the specific modules instead:
//   - xstatePersistence: PersistedXStateData, restoreXStateFromFirestore, createXStateDataFromBookingStatus
//   - xstateTransitions: executeXStateTransition, getAvailableXStateTransitions
//   - xstateEffects: handleStateTransitions (logging only; side effects handled by processing routes)

export type { PersistedXStateData } from "./xstatePersistence";
export {
  createXStateDataFromBookingStatus,
  restoreXStateFromFirestore,
} from "./xstatePersistence";

export {
  executeXStateTransition,
  getAvailableXStateTransitions,
} from "./xstateTransitions";
