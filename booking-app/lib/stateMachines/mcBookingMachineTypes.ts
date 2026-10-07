import type {
  Inputs,
  MediaCommonsServiceFlags,
  Role,
  RoomSetting,
} from "@/components/src/types";
import type { DateSelectArg } from "fullcalendar";
import type { AutomaticCancellationReason } from "@/lib/stateMachines/logAutomaticCancellationTransition";
import type { MediaCommonsServiceKey } from "@/components/src/utils/serviceDecisions";

/**
 * Media Commons service keys as they appear in the machine context
 * (`servicesRequested` / `servicesApproved`). Keep this in sync with the
 * per-service regions of "Services Request" / "Service Closeout" in
 * mcBookingMachine.ts and with `getMediaCommonsServices()`.
 */
export type { MediaCommonsServiceKey };

export interface MediaCommonsBookingContext {
  tenant?: string;
  selectedRooms?: RoomSetting[];
  formData?: Inputs;
  bookingCalendarInfo?: DateSelectArg;
  isWalkIn?: boolean;
  calendarEventId?: string | null;
  email?: string;
  isVip?: boolean;
  role?: Role;
  declineReason?: string;
  origin?: string;
  automationReason?: AutomaticCancellationReason; // Tracks automatic transitions
  servicesRequested?: MediaCommonsServiceFlags;
  servicesApproved?: MediaCommonsServiceFlags;
  // Flag to indicate this XState was created from existing booking without prior xstateData
  _restoredFromStatus?: boolean;
  // Queue of side effects declared by state entry actions. Machine stays pure
  // (assign only); xstate-transition route drains and executes the list after
  // the transition, then clears it before persisting the snapshot.
  pendingSideEffects?: string[];
}

/**
 * Every event the MC machine accepts. Service events are listed explicitly
 * (rather than derived) so the machine file stays a plain literal that
 * Stately Studio can import and export.
 */
export type MediaCommonsBookingEvent =
  /**
   * A requester resubmitted the request. `changedServices` lists the services
   * whose requests changed; only their decisions are reset (ADR-0001). Absent
   * means the caller already reconciled `servicesApproved` from the booking's
   * approval flags, so every decision in context is kept.
   */
  | { type: "edit"; changedServices?: MediaCommonsServiceKey[] }
  | { type: "Modify" }
  | { type: "cancel" }
  | { type: "noShow"; email?: string }
  | { type: "approve" }
  | { type: "checkIn" }
  | { type: "decline"; reason?: string }
  | { type: "checkOut" }
  | { type: "autoCloseScript" }
  | { type: "approveStaff" }
  | { type: "declineStaff" }
  | { type: "closeoutStaff" }
  | { type: "approveCatering" }
  | { type: "declineCatering" }
  | { type: "closeoutCatering" }
  | { type: "approveSetup" }
  | { type: "declineSetup" }
  | { type: "closeoutSetup" }
  | { type: "approveCleaning" }
  | { type: "declineCleaning" }
  | { type: "closeoutCleaning" }
  | { type: "approveSecurity" }
  | { type: "declineSecurity" }
  | { type: "closeoutSecurity" }
  | { type: "approveEquipment" }
  | { type: "declineEquipment" }
  | { type: "closeoutEquipment" }
  | { type: "approveFurnishings" }
  | { type: "declineFurnishings" }
  | { type: "closeoutFurnishings" };
