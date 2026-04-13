import { NextRequest, NextResponse } from "next/server";
import {
  serverGetDocumentById,
  serverFetchAllDataFromCollection,
  serverSaveDataToFirestoreWithId,
} from "@/lib/firebase/server/adminDb";
import { TableNames } from "@/components/src/policy";
import { isValidTenant } from "@/components/src/constants/tenants";
import type { SchemaContextType } from "@/components/src/client/routes/components/SchemaProvider";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ tenant: string }> },
) {
  try {
    const { tenant } = await params;

    if (!isValidTenant(tenant)) {
      return NextResponse.json(
        { error: `Invalid tenant: ${tenant}` },
        { status: 400 },
      );
    }

    const userEmail = request.headers.get("x-user-email");
    if (!userEmail) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 },
      );
    }

    // Allow either tenant admins or super admins
    const [usersRights, superAdmins] = await Promise.all([
      serverFetchAllDataFromCollection<{ email: string; isAdmin?: boolean }>(
        TableNames.USERS_RIGHTS,
        [],
        tenant,
      ),
      serverFetchAllDataFromCollection<{ email: string }>(
        TableNames.SUPER_ADMINS,
      ),
    ]);

    const isAdmin = usersRights.some(
      (r) =>
        r.email.toLowerCase() === userEmail.toLowerCase() &&
        r.isAdmin === true,
    );
    const isSuperAdmin = superAdmins.some(
      (sa) => sa.email.toLowerCase() === userEmail.toLowerCase(),
    );

    if (!isAdmin && !isSuperAdmin) {
      return NextResponse.json(
        { error: "Admin permission required" },
        { status: 403 },
      );
    }

    const body = await request.json();
    const { resourceRoomId, serviceType, email: rawEmail, action } = body as {
      resourceRoomId: number;
      serviceType?: string; // omit for resource-level approvers
      email: string;
      action: "add" | "remove";
    };
    const email = typeof rawEmail === "string" ? rawEmail.trim() : "";
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!Number.isFinite(resourceRoomId) || !email || !action) {
      return NextResponse.json(
        { error: "Missing required fields: resourceRoomId, email, action" },
        { status: 400 },
      );
    }

    if (!emailPattern.test(email)) {
      return NextResponse.json(
        { error: "Invalid email" },
        { status: 400 },
      );
    }
    if (action !== "add" && action !== "remove") {
      return NextResponse.json(
        { error: "action must be 'add' or 'remove'" },
        { status: 400 },
      );
    }

    const schema = await serverGetDocumentById<SchemaContextType>(
      TableNames.TENANT_SCHEMA,
      tenant,
    );

    if (!schema) {
      return NextResponse.json(
        { error: `Schema not found for tenant: ${tenant}` },
        { status: 404 },
      );
    }

    const resources = Array.isArray(schema.resources) ? [...schema.resources] : [];
    const resourceIndex = resources.findIndex(
      (r) => r.roomId === resourceRoomId,
    );

    if (resourceIndex === -1) {
      return NextResponse.json(
        { error: `Resource with roomId ${resourceRoomId} not found` },
        { status: 404 },
      );
    }

    const resource = { ...resources[resourceIndex] };
    const normalizedEmail = email.toLowerCase().trim();

    if (!serviceType) {
      // Resource-level approvers (no service specified)
      const approvers: string[] = Array.isArray(resource.approvers)
        ? [...resource.approvers]
        : [];

      if (action === "add") {
        if (approvers.some((a) => a.toLowerCase() === normalizedEmail)) {
          return NextResponse.json(
            { error: "This email is already an approver for this resource" },
            { status: 409 },
          );
        }
        approvers.push(email.trim());
      } else {
        const idx = approvers.findIndex((a) => a.toLowerCase() === normalizedEmail);
        if (idx !== -1) approvers.splice(idx, 1);
      }

      resource.approvers = approvers;
    } else {
      // Per-service approvers
      // Normalize to handle Firestore data that hasn't been migrated from string[] yet
      const services = Array.isArray(resource.services)
        ? resource.services
            .map((s: any) =>
              typeof s === "string"
                ? { type: s, approvers: [] }
                : s != null && typeof s === "object"
                  ? { type: s.type ?? "", approvers: Array.isArray(s.approvers) ? [...s.approvers] : [] }
                  : null,
            )
            .filter((s): s is { type: string; approvers: string[] } => s !== null)
        : [];

      const serviceIndex = services.findIndex((s) => s.type === serviceType);

      if (serviceIndex === -1) {
        return NextResponse.json(
          { error: `Service '${serviceType}' not found on resource ${resourceRoomId}` },
          { status: 404 },
        );
      }

      const service = services[serviceIndex];

      if (action === "add") {
        if (service.approvers.some((a) => a.toLowerCase() === normalizedEmail)) {
          return NextResponse.json(
            { error: "This email is already an approver for this service" },
            { status: 409 },
          );
        }
        service.approvers.push(email.trim());
      } else {
        service.approvers = service.approvers.filter(
          (a) => a.toLowerCase() !== normalizedEmail,
        );
      }

      services[serviceIndex] = service;
      resource.services = services;
    }

    resources[resourceIndex] = resource;

    await serverSaveDataToFirestoreWithId(TableNames.TENANT_SCHEMA, tenant, {
      ...schema,
      resources,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error updating service approvers:", error);
    return NextResponse.json(
      { error: "Failed to update service approvers" },
      { status: 500 },
    );
  }
}
