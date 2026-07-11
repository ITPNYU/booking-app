import { NextResponse } from "next/server";

import { PagePermission } from "@/components/src/types";
import { resolveCallerRole } from "@/lib/api/authz";
import { requireSession, type SessionContext } from "@/lib/api/requireSession";

/**
 * Server-side super-admin gate for API routes. Derives the caller identity from
 * the verified NextAuth session (never from a client-supplied header) and checks
 * it against the SUPER_ADMINS collection via resolveCallerRole.
 *
 * On success returns `{ session }` (with the verified caller email); otherwise
 * returns `{ error }` with the NextResponse (401/403) the route should return.
 * Usage:
 *   const auth = await requireSuperAdmin(tenant);
 *   if ("error" in auth) return auth.error;
 *   // auth.session.email is the verified caller
 */
export async function requireSuperAdmin(
  tenant?: string,
): Promise<{ session: SessionContext } | { error: NextResponse }> {
  const session = await requireSession();
  if (!session) {
    return {
      error: NextResponse.json(
        { error: "Authentication required" },
        { status: 401 },
      ),
    };
  }
  const role = await resolveCallerRole(session, tenant);
  if (role !== PagePermission.SUPER_ADMIN) {
    return {
      error: NextResponse.json(
        { error: "Super admin permission required" },
        { status: 403 },
      ),
    };
  }
  return { session };
}
