import { NextRequest, NextResponse } from "next/server";

import { isValidTenant } from "@/components/src/constants/tenants";
import { TableNames, getTenantCollectionName } from "@/components/src/policy";
import { PagePermission } from "@/components/src/types";
import {
  type ApproverChange,
  type ApproversResource,
  applyApproverChange,
  getApproverResources,
  getApproversResourceDocumentId,
  getResourceApproverServices,
  isApproverService,
  toApproversResource,
} from "@/components/src/utils/approversResources";
import { resolveCallerRole } from "@/lib/api/authz";
import { requireSession } from "@/lib/api/requireSession";
import admin from "@/lib/firebase/server/firebaseAdmin";
import { serverGetTenantResources } from "@/lib/tenant/serverGetTenantResources";

const NYU_EMAIL = /^[a-z0-9._-]+@nyu\.edu$/i;

const parseChange = (
  body: Record<string, unknown>,
): ApproverChange | string => {
  const { action, kind, service, email } = body;
  if (action !== "add" && action !== "remove") {
    return "action must be add or remove";
  }
  if (typeof email !== "string" || !email.trim()) return "email required";
  if (action === "add" && !NYU_EMAIL.test(email.trim())) {
    return "Enter a valid NYU NetID email.";
  }
  if (kind === "resource") return { action, email, kind };
  if (kind === "service") {
    if (!isApproverService(service)) return "unknown service";
    return { action, email, kind, service };
  }
  return "kind must be resource or service";
};

/**
 * Add or remove one approver on a resource's `usersApproversResources` doc.
 * The only write path for that collection: it checks the resource and
 * service against the tenant schema and rewrites `serviceApproverEmails`
 * in the same transaction.
 */
export async function POST(req: NextRequest) {
  const session = await requireSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const tenant = req.headers.get("x-tenant") ?? "";
  if (!isValidTenant(tenant)) {
    return NextResponse.json({ error: "Invalid tenant" }, { status: 400 });
  }
  const role = await resolveCallerRole(session, tenant);
  if (role !== PagePermission.ADMIN && role !== PagePermission.SUPER_ADMIN) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const resourceId =
    typeof body?.resourceId === "string" ? body.resourceId.trim() : "";
  if (!resourceId) {
    return NextResponse.json({ error: "resourceId required" }, { status: 400 });
  }
  const change = parseChange(body);
  if (typeof change === "string") {
    return NextResponse.json({ error: change }, { status: 400 });
  }

  const resources = await serverGetTenantResources(tenant);
  const resource = getApproverResources(resources).find(
    candidate => candidate.resourceId === resourceId,
  );
  if (!resource) {
    return NextResponse.json(
      { error: `Unknown resource ${resourceId}` },
      { status: 404 },
    );
  }
  if (
    change.kind === "service" &&
    change.action === "add" &&
    !getResourceApproverServices(resource, resources).includes(change.service)
  ) {
    return NextResponse.json(
      { error: `${resourceId} does not offer ${change.service}` },
      { status: 400 },
    );
  }

  try {
    const db = admin.firestore();
    const ref = db
      .collection(
        getTenantCollectionName(TableNames.APPROVERS_RESOURCES, tenant),
      )
      .doc(getApproversResourceDocumentId(resourceId));
    const approvers = await db.runTransaction<ApproversResource>(async tx => {
      const snapshot = await tx.get(ref);
      const next = applyApproverChange(
        toApproversResource(
          resourceId,
          snapshot.exists ? snapshot.data() : undefined,
        ),
        change,
      );
      tx.set(ref, {
        ...next,
        updatedAt: admin.firestore.Timestamp.now(),
        updatedBy: session.email,
      });
      return next;
    });
    return NextResponse.json({ approvers });
  } catch (error) {
    console.error("[/api/approversResources] error:", error);
    return NextResponse.json(
      { error: (error as Error).message ?? "Internal error" },
      { status: 500 },
    );
  }
}
