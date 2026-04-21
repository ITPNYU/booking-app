import type { HandlerContext, StateHandler } from "./types";

/**
 * Handler for the `Closed` state entry.
 *
 * Close-processing (emails, final calendar state, etc.) is triggered by
 * the XState machine via `/api/close-processing`, not by this dispatcher.
 * For the ITP auto-close path (Checked In → Checked Out → Closed via
 * `always` transition), checkout-processing runs from `db.ts` checkOut()
 * after this dispatcher returns; the special-case log below documents
 * that flow.
 */
export const handleClosedEntry: StateHandler = async (
  ctx: HandlerContext,
) => {
  const { calendarEventId, tenant, previousState, newState } = ctx;

  console.log(
    `🎯 XSTATE REACHED CLOSED [${tenant?.toUpperCase() || "UNKNOWN"}]:`,
    {
      calendarEventId,
      previousState,
      newState,
    },
  );

  if (previousState === "Checked In") {
    console.log(
      `📤 XSTATE CHECKOUT VIA AUTO-CLOSE [${tenant?.toUpperCase() || "UNKNOWN"}]:`,
      { calendarEventId, previousState, newState, note: "checkout-processing will be called by client" },
    );
  }
};
