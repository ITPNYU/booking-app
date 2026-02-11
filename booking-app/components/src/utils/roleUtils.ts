import { Role } from "@/components/src/types";

export type BaseRole = "admin" | "faculty" | "student";

/**
 * Maps a role (enum or string) to the canonical base role used for limits and auto-approval.
 * Single source of truth so booking hour limits, auto-approval utils, and future logic stay in sync.
 */
export function getBaseRole(role: Role | string | undefined): BaseRole {
  if (role == null) return "student";

  const s = String(role);
  // Role enum values (exact match)
  if (s === Role.STUDENT) return "student";
  if (
    s === Role.FACULTY ||
    s === Role.RESIDENT_FELLOW ||
    s === Role.CHAIR_PROGRAM_DIRECTOR
  ) {
    return "faculty";
  }
  if (s === Role.ADMIN_STAFF) return "admin";

  // Free-form string from API/context: normalize by substring match
  const lower = s.toLowerCase();
  if (
    lower.includes("admin") ||
    lower.includes("staff") ||
    lower.includes("chair") ||
    lower.includes("director")
  ) {
    return "admin";
  }
  if (
    lower.includes("faculty") ||
    lower.includes("fellow") ||
    lower.includes("resident")
  ) {
    return "faculty";
  }

  return "student";
}
