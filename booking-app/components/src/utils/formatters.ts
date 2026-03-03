/**
 * Common formatter functions that can be used from both client and server code
 */

/**
 * Formats origin values consistently across the application
 * @param origin - The origin string to format
 * @returns Formatted origin string
 */
export const formatOrigin = (origin: string | undefined): string => {
  if (!origin) return "User";

  const originMap: Record<string, string> = {
    user: "User",
    vip: "VIP",
    walkIn: "Walk-In",
    "walk-in": "Walk-In",
    pregame: "Pregame",
  };

  return originMap[origin] ?? origin;
};

/**
 * Gets the formatted secondary contact name from booking contents
 * Handles both old format (secondaryName) and new format (secondaryFirstName + secondaryLastName)
 * @param bookingContents - The booking contents object
 * @returns Formatted secondary contact name or empty string
 */
export const getSecondaryContactName = (bookingContents: any): string => {
  const firstName = bookingContents.secondaryFirstName?.toString() || "";
  const lastName = bookingContents.secondaryLastName?.toString() || "";
  const fullName = `${firstName} ${lastName}`.trim();
  
  if (fullName) {
    return fullName;
  }
  
  // Fallback to old format
  return bookingContents.secondaryName?.toString() || "";
};
