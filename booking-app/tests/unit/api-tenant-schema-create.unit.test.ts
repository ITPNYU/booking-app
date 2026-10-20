import { buildNewTenantSchema } from "@/lib/tenant/buildNewTenantSchema";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";

const mockServerGetDocumentById = vi.fn();
const mockServerSaveDataToFirestoreWithId = vi.fn();
const mockListTenantSchemaIds = vi.fn();
const mockRequireSuperAdmin = vi.fn();

vi.mock("@/lib/firebase/server/adminDb", () => ({
  serverGetDocumentById: (...args: unknown[]) => mockServerGetDocumentById(...args),
  serverSaveDataToFirestoreWithId: (...args: unknown[]) =>
    mockServerSaveDataToFirestoreWithId(...args),
}));

vi.mock("@/lib/tenant/listTenantSchemaIds", () => ({
  listTenantSchemaIds: (...args: unknown[]) => mockListTenantSchemaIds(...args),
}));

vi.mock("@/lib/api/requireSuperAdmin", () => ({
  requireSuperAdmin: (...args: unknown[]) => mockRequireSuperAdmin(...args),
}));

import { GET, POST } from "@/app/api/tenantSchema/route";

const SUPER = { email: "admin@nyu.edu", netId: "admin" };

const parseJson = async (response: Response) => {
  const data = await response.json();
  return { data, status: response.status };
};

function postSchema(body: unknown) {
  return new NextRequest("http://localhost:3000/api/tenantSchema", {
    method: "POST",
    headers: new Headers({ "Content-Type": "application/json" }),
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireSuperAdmin.mockResolvedValue({ session: SUPER });
  mockServerGetDocumentById.mockResolvedValue(null);
  mockServerSaveDataToFirestoreWithId.mockResolvedValue(undefined);
  mockListTenantSchemaIds.mockResolvedValue(["_template", "itp", "mc"]);
});

describe("GET /api/tenantSchema", () => {
  it("returns schema document ids for a super admin", async () => {
    const response = await GET();
    const { data, status } = await parseJson(response);

    expect(status).toBe(200);
    expect(data.ids).toEqual(["_template", "itp", "mc"]);
  });

  it("rejects a caller who is not a super admin", async () => {
    mockRequireSuperAdmin.mockResolvedValue({
      error: NextResponse.json({ error: "Super admin permission required" }, { status: 403 }),
    });

    const response = await GET();
    const { status } = await parseJson(response);

    expect(status).toBe(403);
  });
});

describe("POST /api/tenantSchema", () => {
  it("creates a schema once", async () => {
    const schema = buildNewTenantSchema({
      tenantId: "studio",
      name: "Studio Lab",
      nameForPolicy: "",
      logo: "",
      resourceName: "Room",
    });

    const response = await POST(postSchema(schema));
    const { data, status } = await parseJson(response);

    expect(status).toBe(200);
    expect(data).toEqual({ success: true, tenantId: "studio" });
    expect(mockServerSaveDataToFirestoreWithId).toHaveBeenCalledTimes(1);
    expect(mockServerSaveDataToFirestoreWithId).toHaveBeenCalledWith(
      "tenantSchema",
      "studio",
      expect.objectContaining({
        tenantId: "studio",
        resources: [],
      }),
    );
  });

  it("rejects a second create for the same slug", async () => {
    mockServerGetDocumentById.mockResolvedValue({ tenantId: "studio" });

    const response = await POST(
      postSchema(
        buildNewTenantSchema({
          tenantId: "studio",
          name: "Studio Lab",
          nameForPolicy: "",
          logo: "",
          resourceName: "Room",
        }),
      ),
    );
    const { data, status } = await parseJson(response);

    expect(status).toBe(409);
    expect(data.error).toMatch(/already exists/i);
    expect(mockServerSaveDataToFirestoreWithId).not.toHaveBeenCalled();
  });

  it.each(["_template", "api", "signin", "mediaCommons", "Studio", ""])(
    "rejects slug %s",
    async (tenantId) => {
      const response = await POST(
        postSchema({
          tenantId,
          tenant: { name: "Nope" },
          resources: [],
        }),
      );
      const { data, status } = await parseJson(response);

      expect(status).toBe(400);
      expect(data.error).toMatch(/invalid tenant slug/i);
      expect(mockServerSaveDataToFirestoreWithId).not.toHaveBeenCalled();
    },
  );

  it("rejects a schema that cannot be coerced", async () => {
    const response = await POST(
      postSchema({
        tenantId: "studio",
        tenant: { name: "Studio Lab" },
        resources: [{ name: "Room", resourceId: "" }],
      }),
    );
    const { data, status } = await parseJson(response);

    expect(status).toBe(400);
    expect(data.error).toMatch(/invalid schema/i);
    expect(mockServerSaveDataToFirestoreWithId).not.toHaveBeenCalled();
  });
});
