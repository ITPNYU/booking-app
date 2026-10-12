import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { generateDefaultSchema } from "@/components/src/client/routes/components/schemaTypes";

const mockServerGetDocumentById = vi.fn();
const mockServerSaveDataToFirestoreWithId = vi.fn();
const mockListTenantSchemaDocuments = vi.fn();
const mockRequireSuperAdmin = vi.fn();

vi.mock("@/lib/firebase/server/adminDb", () => ({
  serverGetDocumentById: (...args: unknown[]) =>
    mockServerGetDocumentById(...args),
  serverSaveDataToFirestoreWithId: (...args: unknown[]) =>
    mockServerSaveDataToFirestoreWithId(...args),
}));

vi.mock("@/lib/tenant/listTenantSchemas", () => ({
  listTenantSchemaDocuments: (...args: unknown[]) =>
    mockListTenantSchemaDocuments(...args),
}));

vi.mock("@/lib/api/requireSuperAdmin", () => ({
  requireSuperAdmin: (...args: unknown[]) => mockRequireSuperAdmin(...args),
}));

import { GET, POST } from "@/app/api/tenantSchema/route";

const SUPER = { email: "admin@nyu.edu", netId: "admin" };

const createRequest = (body: unknown) =>
  new NextRequest("http://localhost:3000/api/tenantSchema", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireSuperAdmin.mockResolvedValue({ session: SUPER });
  mockServerSaveDataToFirestoreWithId.mockResolvedValue(undefined);
  mockListTenantSchemaDocuments.mockResolvedValue([{ id: "mc" }, { id: "itp" }]);
});

describe("POST /api/tenantSchema", () => {
  it("returns 401 when unauthenticated", async () => {
    mockRequireSuperAdmin.mockResolvedValue({
      error: NextResponse.json(
        { error: "Authentication required" },
        { status: 401 },
      ),
    });

    const response = await POST(createRequest({ tenantId: "studio" }));
    expect(response.status).toBe(401);
    expect(mockServerSaveDataToFirestoreWithId).not.toHaveBeenCalled();
  });

  it("rejects a reserved slug", async () => {
    const response = await POST(
      createRequest({ ...generateDefaultSchema("api"), tenantId: "api" }),
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain("Invalid tenant slug");
    expect(mockServerSaveDataToFirestoreWithId).not.toHaveBeenCalled();
  });

  it("rejects a duplicate tenant", async () => {
    mockServerGetDocumentById.mockResolvedValue({ tenantId: "studio" });

    const response = await POST(createRequest(generateDefaultSchema("studio")));
    const data = await response.json();

    expect(response.status).toBe(409);
    expect(data.error).toContain("already exists");
    expect(mockServerSaveDataToFirestoreWithId).not.toHaveBeenCalled();
  });

  it("rejects a schema that cannot be coerced", async () => {
    mockServerGetDocumentById.mockResolvedValue(null);

    const response = await POST(
      createRequest({
        ...generateDefaultSchema("studio"),
        resources: [{ resourceId: "a,b", name: "Bad" }],
      }),
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain("Invalid schema");
    expect(mockServerSaveDataToFirestoreWithId).not.toHaveBeenCalled();
  });

  it("writes a valid new tenant schema", async () => {
    mockServerGetDocumentById.mockResolvedValue(null);
    const schema = generateDefaultSchema("studio");
    schema.tenant.name = "Studio Lab";
    schema.bookingProfile = "itp";
    schema.access = { allNyu: true, deptCodes: [] };

    const response = await POST(createRequest(schema));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({ success: true, tenantId: "studio" });
    expect(mockServerSaveDataToFirestoreWithId).toHaveBeenCalledWith(
      "tenantSchema",
      "studio",
      expect.objectContaining({
        tenantId: "studio",
        bookingProfile: "itp",
      }),
    );
  });

  it("initializes the template only when it is absent", async () => {
    mockServerGetDocumentById.mockResolvedValueOnce(null);

    const created = await POST(
      createRequest({ action: "initialize-template" }),
    );
    expect(created.status).toBe(200);
    expect(mockServerSaveDataToFirestoreWithId).toHaveBeenCalledWith(
      "tenantSchema",
      "_template",
      expect.objectContaining({ tenantId: "_template" }),
    );

    mockServerGetDocumentById.mockResolvedValueOnce({ tenantId: "_template" });
    const duplicate = await POST(
      createRequest({ action: "initialize-template" }),
    );
    expect(duplicate.status).toBe(409);
  });
});

describe("GET /api/tenantSchema", () => {
  it("lists schema document ids for a super admin", async () => {
    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.ids).toEqual(["mc", "itp"]);
  });
});
