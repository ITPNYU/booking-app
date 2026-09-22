import {
  normalizeMemoRoles,
  type BookingDetailConfig,
  type BookingDetailRole,
} from "@/components/src/client/routes/components/schemaTypes";
import { PageContextLevel, PagePermission } from "@/components/src/types";
import { hasAnyPermission } from "@/components/src/utils/permissions";

export { normalizeMemoRoles };

/**
 * Whether a caller with `userPermission` may read or write the memo under
 * `detail`. Uses the permission hierarchy, so ADMIN satisfies a role list
 * that names only SERVICES.
 */
export function canAccessMemo(
  detail: Pick<BookingDetailConfig, "showMemo" | "memoRoles">,
  userPermission: PagePermission,
): boolean {
  if (!detail.showMemo) return false;
  return hasAnyPermission(
    userPermission,
    detail.memoRoles.map((r) => PagePermission[r]),
  );
}

/** Roles a page context stands for; built lazily so partial test mocks of the types module do not break module load. */
function rolesForContext(
  pageContext: PageContextLevel,
): BookingDetailRole[] | undefined {
  switch (pageContext) {
    case PageContextLevel.PA:
      return ["PA"];
    case PageContextLevel.LIAISON:
      return ["LIAISON"];
    case PageContextLevel.SERVICES:
      return ["SERVICES"];
    case PageContextLevel.ADMIN:
      return ["ADMIN", "SUPER_ADMIN"];
    default:
      return undefined;
  }
}

/**
 * Whether the Memo section may appear on the page rendered for
 * `pageContext`. The USER context (My Bookings) never shows it.
 */
export function isMemoContextAllowed(
  detail: Pick<BookingDetailConfig, "memoRoles">,
  pageContext: PageContextLevel | undefined,
): boolean {
  if (pageContext === undefined) return false;
  const roles = rolesForContext(pageContext);
  if (!roles) return false;
  return roles.some((r) => detail.memoRoles.includes(r));
}
