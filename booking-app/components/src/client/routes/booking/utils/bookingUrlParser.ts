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
