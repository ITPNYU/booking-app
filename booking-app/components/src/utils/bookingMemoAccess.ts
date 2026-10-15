import {
  normalizeMemoRoles,
  normalizeWebCheckoutRoles,
  type BookingDetailRole,
  type DetailsModalConfig,
} from "@/components/src/client/routes/components/schemaTypes";
import { PageContextLevel, PagePermission } from "@/components/src/types";
import { hasAnyPermission } from "@/components/src/utils/permissions";

export { normalizeMemoRoles, normalizeWebCheckoutRoles };

/** Reading a booking detail field, or editing it. */
export type DetailAccess = "view" | "edit";
/** Reading the memo, or editing it. */
export type MemoAccess = DetailAccess;

/** A view and an edit role list from `detailsModal`. */
type DetailRoleLists = {
  viewRoles: BookingDetailRole[];
  editRoles: BookingDetailRole[];
};

type MemoRoleConfig = Pick<
  DetailsModalConfig,
  "memoViewRoles" | "memoEditRoles"
>;

type WebCheckoutRoleConfig = Pick<
  DetailsModalConfig,
  "webCheckoutViewRoles" | "webCheckoutEditRoles"
>;

/** Roles granted `access`. Editing implies viewing, so view includes the edit roles. */
function rolesFor(
  lists: DetailRoleLists,
  access: DetailAccess,
): BookingDetailRole[] {
  if (access === "edit") return lists.editRoles;
  return Array.from(new Set([...lists.viewRoles, ...lists.editRoles]));
}

/**
 * Whether `userPermission` satisfies the roles granted `access`. Uses the
 * permission hierarchy, so ADMIN satisfies a role list that names only
 * SERVICES.
 */
function canAccessDetail(
  lists: DetailRoleLists,
  userPermission: PagePermission,
  access: DetailAccess,
): boolean {
  return hasAnyPermission(
    userPermission,
    rolesFor(lists, access).map((r) => PagePermission[r]),
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
 * Whether the page rendered for `pageContext` is one of the roles granted
 * `access`. The USER context (My Bookings) never is.
 */
function isDetailContextAllowed(
  lists: DetailRoleLists,
  pageContext: PageContextLevel | undefined,
  access: DetailAccess,
): boolean {
  if (pageContext === undefined) return false;
  const roles = rolesForContext(pageContext);
  if (!roles) return false;
  const allowed = rolesFor(lists, access);
  return roles.some((r) => allowed.includes(r));
}

const memoLists = (config: MemoRoleConfig): DetailRoleLists => ({
  viewRoles: config.memoViewRoles,
  editRoles: config.memoEditRoles,
});

const webCheckoutLists = (config: WebCheckoutRoleConfig): DetailRoleLists => ({
  viewRoles: config.webCheckoutViewRoles,
  editRoles: config.webCheckoutEditRoles,
});

/**
 * Whether a caller with `userPermission` has `access` to the memo under
 * `config`.
 */
export function canAccessMemo(
  config: Pick<DetailsModalConfig, "showMemo"> & MemoRoleConfig,
  userPermission: PagePermission,
  access: MemoAccess,
): boolean {
  if (!config.showMemo) return false;
  return canAccessDetail(memoLists(config), userPermission, access);
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
  return isDetailContextAllowed(memoLists(config), pageContext, access);
}

/**
 * Whether a caller with `userPermission` has `access` to the WebCheckout cart
 * under `config`.
 */
export function canAccessWebCheckoutCart(
  config: Pick<DetailsModalConfig, "showWebCheckout"> & WebCheckoutRoleConfig,
  userPermission: PagePermission,
  access: DetailAccess,
): boolean {
  if (!config.showWebCheckout) return false;
  return canAccessDetail(webCheckoutLists(config), userPermission, access);
}

/**
 * Whether the page rendered for `pageContext` grants staff `access` to the
 * WebCheckout cart. The USER context (My Bookings) never does; the requester's
 * read-only view of their own cart there is handled by the modal.
 */
export function isWebCheckoutContextAllowed(
  config: WebCheckoutRoleConfig,
  pageContext: PageContextLevel | undefined,
  access: DetailAccess,
): boolean {
  return isDetailContextAllowed(webCheckoutLists(config), pageContext, access);
}
