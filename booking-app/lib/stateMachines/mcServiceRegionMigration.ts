import type { MediaCommonsServiceFlags } from "@/components/src/types";

/**
 * Service regions added to the MC machine after bookings were already
 * persisted. A stored snapshot from before the region existed has no entry
 * for it, and XState restores such a region in its "Evaluate …" state without
 * running the eventless transition — so `snapshot.can({ type: "approveX" })`
 * stays false until some other event nudges the machine. Filling the region
 * in from the booking's current service flags puts the restored actor in the
 * same state a fresh evaluation would have produced.
 */
const LATE_ADDED_SERVICE_REGIONS: ReadonlyArray<{
  key: keyof MediaCommonsServiceFlags;
  requestRegion: string;
  requestedState: string;
  requestApprovedState: string;
  closeoutRegion: string;
  closeoutPendingState: string;
  closedoutState: string;
}> = [
  {
    key: "furnishings",
    requestRegion: "Furnishings Request",
    requestedState: "Furnishings Requested",
    requestApprovedState: "Furnishings Approved",
    closeoutRegion: "Furnishings Closeout",
    closeoutPendingState: "Furnishings Closeout Pending",
    closedoutState: "Furnishings Closedout",
  },
];

type StateValue = string | Record<string, unknown>;

/**
 * Returns a copy of `value` where every late-added service region missing
 * from "Services Request" / "Service Closeout" is set to the state the
 * region's own guards would pick. Non-parallel values are returned as is.
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
    for (const region of LATE_ADDED_SERVICE_REGIONS) {
      if (region.requestRegion in regions) continue;
      regions[region.requestRegion] = servicesRequested?.[region.key]
        ? region.requestedState
        : region.requestApprovedState;
      changed = true;
    }
    if (changed) {
      next = { ...value, "Services Request": regions };
    }
  }

  if (closeout && typeof closeout === "object") {
    const regions = { ...(closeout as Record<string, unknown>) };
    let changed = false;
    for (const region of LATE_ADDED_SERVICE_REGIONS) {
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
