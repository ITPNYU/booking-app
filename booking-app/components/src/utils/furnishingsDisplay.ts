/**
 * Display helpers for the additional event furniture ("furnishings") request.
 * The booking stores a yes/no per room plus optional details and chartfields;
 * the booking details modal and the booking_detail email render the same
 * flattened strings.
 */

type FurnishingsFields = {
  furnishingsByRoom?: Record<string, string> | null;
  chartFieldForFurnishingsByRoom?: Record<string, string> | null;
  furnishingsDetails?: string | null;
};

const isYes = (value: unknown): boolean =>
  typeof value === "string" && value.trim().toLowerCase() === "yes";

/** Room ids whose furnishings switch is "yes", in stored order. */
export function getFurnishingsRequestedRoomIds(
  furnishingsByRoom: FurnishingsFields["furnishingsByRoom"],
): string[] {
  if (!furnishingsByRoom || typeof furnishingsByRoom !== "object") return [];
  return Object.entries(furnishingsByRoom)
    .filter(([, value]) => isYes(value))
    .map(([roomId]) => roomId);
}

export function hasFurnishingsRequest(
  fields: Pick<FurnishingsFields, "furnishingsByRoom">,
): boolean {
  return getFurnishingsRequestedRoomIds(fields.furnishingsByRoom).length > 0;
}

/** "103, 233 — Two extra tables" or null when nothing is requested. */
export function formatFurnishingsSummary(
  fields: FurnishingsFields,
): string | null {
  const rooms = getFurnishingsRequestedRoomIds(fields.furnishingsByRoom);
  if (rooms.length === 0) return null;
  const details = fields.furnishingsDetails?.trim();
  return [rooms.join(", "), details || null].filter(Boolean).join(" — ");
}

/** "103: CF-1; 233: CF-2" for requested rooms only, or null when none. */
export function formatFurnishingsChartFields(
  fields: FurnishingsFields,
): string | null {
  const requested = new Set(
    getFurnishingsRequestedRoomIds(fields.furnishingsByRoom),
  );
  const parts = Object.entries(fields.chartFieldForFurnishingsByRoom ?? {})
    .filter(
      ([roomId, chart]) =>
        requested.has(roomId) && typeof chart === "string" && chart.trim(),
    )
    .map(([roomId, chart]) => `${roomId}: ${chart.trim()}`);
  return parts.length > 0 ? parts.join("; ") : null;
}
