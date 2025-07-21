import { BookingOrigin } from "../../types";

export const formatOrigin = (
  origin: BookingOrigin | string | undefined
): string => {
  if (!origin) return "User";
  switch (origin) {
    case BookingOrigin.USER:
      return "User";
    case BookingOrigin.ADMIN:
      return "Admin";
    case BookingOrigin.WALK_IN:
      return "Walk-In";
    case BookingOrigin.VIP:
      return "VIP";
    case BookingOrigin.PREGAME:
      return "Pre-Game";
    default:
      // fallback: capitalize first letter
      return origin.charAt(0).toUpperCase() + origin.slice(1);
  }
};
