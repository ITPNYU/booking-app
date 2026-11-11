/**
 * Default wording of the two reassignment emails. The tenant schema sync
 * copies these into each tenant's `emailNotifications`, where admins can
 * change them; the app falls back to them only when a tenant leaves one blank.
 */
export const DEFAULT_REASSIGNED_USER_MESSAGE =
  "This reservation has been assigned to you.";

/** Placeholder replaced with the new requester's name and email. */
export const NEW_REQUESTER_PLACEHOLDER = "${newRequester}";

export const DEFAULT_REASSIGNED_PREVIOUS_USER_MESSAGE = `This reservation has been reassigned to ${NEW_REQUESTER_PLACEHOLDER}. It no longer appears in your bookings.`;
