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
