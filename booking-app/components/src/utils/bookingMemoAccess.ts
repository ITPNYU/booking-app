import {
  normalizeMemoRoles,
  type BookingDetailRole,
  type DetailsModalConfig,
} from "@/components/src/client/routes/components/schemaTypes";
import { PageContextLevel, PagePermission } from "@/components/src/types";
import { hasAnyPermission } from "@/components/src/utils/permissions";

export { normalizeMemoRoles };

/** Reading the memo, or editing it. */
export type MemoAccess = "view" | "edit";

type MemoRoleConfig = Pick<
  DetailsModalConfig,
  "memoViewRoles" | "memoEditRoles"
>;

/** Roles granted `access`. Editing implies viewing, so view includes the edit roles. */
function memoRolesFor(
  config: MemoRoleConfig,
  access: MemoAccess,
): BookingDetailRole[] {
  if (access === "edit") return config.memoEditRoles;
  return Array.from(
    new Set([...config.memoViewRoles, ...config.memoEditRoles]),
  );
}

/**
 * Whether a caller with `userPermission` has `access` to the memo under
 * `config`. Uses the permission hierarchy, so ADMIN satisfies a role list
 * that names only SERVICES.
 */
export function canAccessMemo(
  config: Pick<DetailsModalConfig, "showMemo"> & MemoRoleConfig,
  userPermission: PagePermission,
  access: MemoAccess,
): boolean {
  if (!config.showMemo) return false;
  return hasAnyPermission(
    userPermission,
    memoRolesFor(config, access).map((r) => PagePermission[r]),
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
 * Whether the page rendered for `pageContext` grants `access` to the memo.
 * The USER context (My Bookings) never does.
 */
export function isMemoContextAllowed(
  config: MemoRoleConfig,
  pageContext: PageContextLevel | undefined,
  access: MemoAccess,
): boolean {
  if (pageContext === undefined) return false;
  const roles = rolesForContext(pageContext);
  if (!roles) return false;
  const allowed = memoRolesFor(config, access);
  return roles.some((r) => allowed.includes(r));
}
