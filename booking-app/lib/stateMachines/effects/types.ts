/**
 * Shared types for per-state effect handlers in `handleStateTransitions`.
 *
 * Each handler receives a single `HandlerContext` bundling everything it
 * might need — the state transition metadata, the booking document already
 * fetched from Firestore, and the mutable `firestoreUpdates` object that
 * the dispatcher will persist after handlers run.
 *
 * The dispatcher builds the context once per transition; handlers read
 * from it freely and mutate `firestoreUpdates` to queue field updates.
 */
export interface HandlerContext {
  previousState: string;
  newState: string | object;
  calendarEventId: string;
  email: string;
  tenant: string;
  firestoreUpdates: any;
  bookingDoc: any;
  skipCalendarForServiceCloseout: boolean;
  isXStateCreation: boolean;
  reason?: string;
}

export type StateHandler = (ctx: HandlerContext) => Promise<void>;
