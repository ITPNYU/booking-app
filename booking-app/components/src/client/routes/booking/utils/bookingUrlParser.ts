/**
 * Simple utilities for parsing and building booking URLs
 * Patterns: /tenant/book/step or /tenant/edit/step/id
 */

export function parseBookingUrl(pathname: string) {
  const [, tenant, flowType, step, id] = pathname.split("/");
  return {
    tenant: tenant || "",
    flowType: flowType || "",
    step: step || null,
    id: id || null,
  };
}

/**
 * Identifies the request a pathname belongs to: the same tenant, flow and
 * booking id on every step of one request, different for any other request.
 */
export function getBookingFlowKey(pathname: string | null): string {
  const { tenant, flowType, id } = parseBookingUrl(pathname ?? "");
  return [tenant, flowType, id ?? ""].join("/");
}

const STEP_ONLY_FLOWS = ["book", "walk-in", "vip"];
const BOOKING_ID_FLOWS = ["edit", "modification"];

/**
 * Whether a pathname is a step of a booking flow, as opposed to a flow's
 * landing page (/tenant/book, /tenant/edit/id) or a page outside the flows.
 */
export function isBookingStepPath(pathname: string | null): boolean {
  const { flowType, step, id } = parseBookingUrl(pathname ?? "");
  if (STEP_ONLY_FLOWS.includes(flowType)) return step !== null;
  // Without a step, the booking id sits where the step would be.
  if (BOOKING_ID_FLOWS.includes(flowType)) return id !== null;
  return false;
}

export function buildBookingUrl(
  tenant: string,
  flowType: string,
  step: string,
  id?: string | null,
): string {
  const parts = [tenant, flowType, step];
  if (id) parts.push(id);
  return `/${parts.join("/")}`;
}

export function getAffiliationStep(flowType: string): string {
  return flowType === "walk-in" ? "netid" : "role";
}
