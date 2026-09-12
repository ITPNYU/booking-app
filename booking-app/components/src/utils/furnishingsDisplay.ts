/**
 * Display helpers for the additional event furniture ("furnishings") request.
 * The booking stores a yes/no per room plus per-room details and chartfields;
 * the booking details modal and the booking_detail email render the same
 * per-room lines, in the same shape as the other per-room services
 * ("103: Two extra tables (chartfield: 12345-12)").
 */

type FurnishingsFields = {
  furnishingsByRoom?: Record<string, string> | null;
  chartFieldForFurnishingsByRoom?: Record<string, string> | null;
  furnishingsDetailsByRoom?: Record<string, string> | null;
  furnishingsDetails?: string | null;
};

const isYes = (value: unknown): boolean =>
  typeof value === "string" && value.trim().toLowerCase() === "yes";

const trimmed = (value: unknown): string =>
  typeof value === "string" ? value.trim() : "";

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

/**
 * One line per requested room: "<room>: <details or yes> (chartfield: <cf>)".
 * Bookings stored before per-room details existed only have the joined
 * `furnishingsDetails`; that is appended as a final "Details: …" line.
 */
export function formatFurnishingsLines(fields: FurnishingsFields): string[] {
  const rooms = getFurnishingsRequestedRoomIds(fields.furnishingsByRoom);
  if (rooms.length === 0) return [];

  const detailsByRoom = fields.furnishingsDetailsByRoom ?? {};
  const chartByRoom = fields.chartFieldForFurnishingsByRoom ?? {};
  const hasPerRoomDetails = rooms.some((roomId) =>
    trimmed(detailsByRoom[roomId]),
  );

  const lines = rooms.map((roomId) => {
    const details = trimmed(detailsByRoom[roomId]) || "yes";
    const chart = trimmed(chartByRoom[roomId]);
    return chart
      ? `${roomId}: ${details} (chartfield: ${chart})`
      : `${roomId}: ${details}`;
  });

  const joined = trimmed(fields.furnishingsDetails);
  if (!hasPerRoomDetails && joined) {
    lines.push(`Details: ${joined}`);
  }
  return lines;
}
