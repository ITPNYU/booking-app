import type { MediaCommonsServiceFlags } from "@/components/src/types";

/**
 * A stored snapshot that has no entry for a service region is restored in
 * that region's "Evaluate …" state, and XState does not run the eventless
 * transition — so `snapshot.can({ type: "approveX" })` stays false. That
 * happens for regions added after a booking was persisted (Furnishings) and
 * for the bookingsDirect last-resort snapshot, which used to store
 * `"Services Request": {}`. Filling a missing region from the booking's
 * current service flags puts the restored actor in the same state a fresh
 * evaluation would have produced. Regions already present are left alone.
 *
 * State names match the literals in mcBookingMachine.ts.
 */
const MC_SERVICE_REGIONS: ReadonlyArray<{
  key: keyof MediaCommonsServiceFlags;
  requestRegion: string;
  requestedState: string;
  requestApprovedState: string;
  requestDeclinedState: string;
  closeoutRegion: string;
  closeoutPendingState: string;
  closedoutState: string;
}> = (
  [
    ["staff", "Staff"],
    ["catering", "Catering"],
    ["setup", "Setup"],
    ["cleaning", "Cleaning"],
    ["security", "Security"],
    ["equipment", "Equipment"],
    ["furnishings", "Furnishings"],
  ] as const
).map(([key, name]) => ({
  key,
  requestRegion: `${name} Request`,
  requestedState: `${name} Requested`,
  requestApprovedState: `${name} Approved`,
  requestDeclinedState: `${name} Declined`,
  closeoutRegion: `${name} Closeout`,
  closeoutPendingState: `${name} Closeout Pending`,
  closedoutState: `${name} Closedout`,
}));

type StateValue = string | Record<string, unknown>;

/**
 * Returns a copy of `value` where every service region missing from
 * "Services Request" / "Service Closeout" is set to the state the region's
 * own guards would pick. Non-parallel values are returned as is.
 */
export function fillMissingMcServiceRegions(
  value: StateValue | undefined,
  servicesRequested: MediaCommonsServiceFlags | undefined,
  servicesApproved: MediaCommonsServiceFlags | undefined,
): StateValue | undefined {
  if (!value || typeof value !== "object") return value;

  const request = value["Services Request"];
  const closeout = value["Service Closeout"];
  let next: Record<string, unknown> | null = null;

  if (request && typeof request === "object") {
    const regions = { ...(request as Record<string, unknown>) };
    let changed = false;
    for (const region of MC_SERVICE_REGIONS) {
      if (region.requestRegion in regions) continue;
      // Mirrors "Evaluate <Service> Request": a requested service that
      // already holds a decision lands in its final state (ADR-0001).
      const requested = servicesRequested?.[region.key] === true;
      const decision = servicesApproved?.[region.key];
      regions[region.requestRegion] = !requested
        ? region.requestApprovedState
        : decision === true
          ? region.requestApprovedState
          : decision === false
            ? region.requestDeclinedState
            : region.requestedState;
      changed = true;
    }
    if (changed) {
      next = { ...value, "Services Request": regions };
    }
  }

  if (closeout && typeof closeout === "object") {
    const regions = { ...(closeout as Record<string, unknown>) };
    let changed = false;
    for (const region of MC_SERVICE_REGIONS) {
      if (region.closeoutRegion in regions) continue;
      regions[region.closeoutRegion] =
        servicesApproved?.[region.key] === true
          ? region.closeoutPendingState
          : region.closedoutState;
      changed = true;
    }
    if (changed) {
      next = { ...(next ?? value), "Service Closeout": regions };
    }
  }

  return next ?? value;
}
