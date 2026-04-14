import type { HandlerContext, StateHandler } from "./types";

/**
 * Handler for the `Requested` state entry.
 *
 * Decline field cleanup, history logging, and calendar updates for
 * re-requested bookings are handled by the calling API layer, not here.
 * This handler only logs the transition for observability.
 */
export const handleRequestedEntry: StateHandler = async (
  ctx: HandlerContext,
) => {
  const { calendarEventId, tenant, previousState, newState } = ctx;

  console.log(
    `🔄 XSTATE REACHED REQUESTED [${tenant?.toUpperCase() || "UNKNOWN"}]:`,
    {
      calendarEventId,
      previousState,
      newState,
      note: "Decline field cleanup handled by calling API",
    },
  );
};
