import { NextRequest, NextResponse } from "next/server";
import admin from "@/lib/firebase/server/firebaseAdmin";
import { requireSession } from "@/lib/api/requireSession";
import {
  ApproverLevel,
  TableNames,
  getTenantCollectionName,
} from "@/components/src/policy";
import { PagePermission } from "@/components/src/types";

/**
 * Single round-trip endpoint for the permission-resolution data
 * `Provider.tsx` needs on first load.
 *
 * Replaces three separate `/api/firestore/list` round-trips
 * (`usersRights`, `usersSuperAdmin`, `usersApprovers`) with one server-side
 * fan-out via firebase-admin. The auth gate is the same as the per-route
 * proxy: any signed-in NYU user can read these (same as the policy table
 * in `lib/api/authz.ts`).
 *
 * Bonus: `pagePermission` is computed server-side, so the client doesn't
 * have to ship the email-vs-list comparison and the lists themselves are
 * the only authority.
 */
export async function GET(req: NextRequest) {
  const session = await requireSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const tenant = req.nextUrl.searchParams.get("tenant") ?? undefined;

  try {
    const db = admin.firestore();
    const usersRightsRef = db.collection(
      getTenantCollectionName(TableNames.USERS_RIGHTS, tenant),
    );
    const superAdminRef = db.collection(TableNames.SUPER_ADMINS);
    const approversRef = db.collection(
      getTenantCollectionName(TableNames.APPROVERS, tenant),
    );

    const [usersRightsSnap, superAdminSnap, approversSnap] = await Promise.all([
      usersRightsRef.get(),
      superAdminRef.get(),
      approversRef.get(),
    ]);

    const userRightsRecords = usersRightsSnap.docs.map((d) => ({
      id: d.id,
      ...(d.data() as Record<string, unknown>),
    }));
    const adminUsers = userRightsRecords
      .filter((r: any) => r.isAdmin === true)
      .map((r: any) => ({
        id: r.id,
        email: r.email,
        createdAt: r.createdAt,
      }));
    const paUsers = userRightsRecords
      .filter((r: any) => r.isWorker === true)
      .map((r: any) => ({
        id: r.id,
        email: r.email,
        createdAt: r.createdAt,
      }));

    const approvers = approversSnap.docs.map((d) => {
      const data = d.data() as Record<string, unknown>;
      return {
        id: d.id,
        email: data.email,
        department: data.department,
        createdAt: data.createdAt,
        level: Number(data.level),
      };
    });
    const liaisonUsers = approvers;
    const equipmentUsers = approvers.filter(
      (a) => a.level === ApproverLevel.EQUIPMENT,
    );
    const finalApproverEmail =
      (approvers.find((a) => a.level === ApproverLevel.FINAL)?.email as
        | string
        | undefined) ?? "";

    const superAdminUsers = superAdminSnap.docs.map((d) => {
      const data = d.data() as Record<string, unknown>;
      return {
        id: d.id,
        email: data.email,
        createdAt: data.createdAt,
      };
    });

    // Server-side role resolution — single source of truth.
    const email = session.email;
    let pagePermission: PagePermission = PagePermission.BOOKING;
    if (superAdminUsers.some((u: any) => u.email === email)) {
      pagePermission = PagePermission.SUPER_ADMIN;
    } else if (adminUsers.some((u: any) => u.email === email)) {
      pagePermission = PagePermission.ADMIN;
    } else if (equipmentUsers.some((u: any) => u.email === email)) {
      pagePermission = PagePermission.SERVICES;
    } else if (liaisonUsers.some((u: any) => u.email === email)) {
      pagePermission = PagePermission.LIAISON;
    } else if (paUsers.some((u: any) => u.email === email)) {
      pagePermission = PagePermission.PA;
    }

    return NextResponse.json({
      pagePermission,
      adminUsers,
      paUsers,
      liaisonUsers,
      equipmentUsers,
      superAdminUsers,
      policySettings: { finalApproverEmail },
    });
  } catch (error) {
    console.error("[/api/permissions] error:", error);
    return NextResponse.json(
      { error: (error as Error).message ?? "Internal error" },
      { status: 500 },
    );
  }
}
