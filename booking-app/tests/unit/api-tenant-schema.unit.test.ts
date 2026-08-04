import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";

const mockServerGetDocumentById = vi.fn();
const mockServerSaveDataToFirestoreWithId = vi.fn();
const mockFirestoreSet = vi.fn();
const mockFirestoreDoc = vi.fn(() => ({ set: mockFirestoreSet }));
const mockFirestoreCollection = vi.fn(() => ({ doc: mockFirestoreDoc }));
const mockRequireSession = vi.fn();
const mockRequireSuperAdmin = vi.fn();

vi.mock("@/lib/firebase/server/adminDb", () => ({
  serverGetDocumentById: (...args: any[]) => mockServerGetDocumentById(...args),
  serverSaveDataToFirestoreWithId: (...args: any[]) =>
    mockServerSaveDataToFirestoreWithId(...args),
}));

vi.mock("@/lib/firebase/server/firebaseAdmin", () => ({
  default: {
    firestore: () => ({
      collection: mockFirestoreCollection,
    }),
  },
}));

vi.mock("@/lib/utils/calendarEnvironment", () => ({
  applyEnvironmentCalendarIds: (resources: any[]) => resources,
}));

vi.mock("@/components/src/constants/tenants", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/components/src/constants/tenants")>();
  return {
    ...actual,
    isValidTenant: (tenant: string) =>
      ["mc", "itp", "mediaCommons"].includes(tenant),
  };
});

// Auth is now session-derived, not a client header.
vi.mock("@/lib/api/requireSession", () => ({
  requireSession: (...args: any[]) => mockRequireSession(...args),
}));
vi.mock("@/lib/api/requireSuperAdmin", () => ({
  requireSuperAdmin: (...args: any[]) => mockRequireSuperAdmin(...args),
}));

import { GET, PUT } from "@/app/api/tenantSchema/[tenant]/route";

const createRequest = (method: string, body?: any) =>
  new NextRequest("http://localhost:3000/api/tenantSchema/mc", {
    method,
    headers: new Headers({ "Content-Type": "application/json" }),
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

const params = Promise.resolve({ tenant: "mc" });

const parseJson = async (response: Response) => {
  const data = await response.json();
  return { data, status: response.status };
};

const mockSchema = {
  tenantId: "mc",
  tenant: { name: "Media Commons", logo: "", nameForPolicy: "" },
  form: { services: { showEquipment: true } },
  resources: [{ name: "Room 1", resourceId: "1" }],
};

const SUPER = { email: "admin@nyu.edu", netId: "admin" };

beforeEach(() => {
  vi.clearAllMocks();
  // Defaults: authenticated NYU user, super admin. Individual tests override.
  mockRequireSession.mockResolvedValue(SUPER);
  mockRequireSuperAdmin.mockResolvedValue({ session: SUPER });
});

describe("GET /api/tenantSchema/[tenant]", () => {
  it("returns 401 when unauthenticated", async () => {
    mockRequireSession.mockResolvedValue(null);

    const response = await GET(createRequest("GET"), { params });
    const { data, status } = await parseJson(response);

    expect(status).toBe(401);
    expect(data.error).toBe("Authentication required");
  });

  it("returns schema when found", async () => {
    mockServerGetDocumentById.mockResolvedValue(mockSchema);

    const response = await GET(createRequest("GET"), { params });
    const { data, status } = await parseJson(response);

    expect(status).toBe(200);
    expect(data.tenant.name).toBe("Media Commons");
    expect(data.resources).toHaveLength(1);
    expect(data.resources[0].resourceId).toBe("1");
    expect(data.resources[0]).not.toHaveProperty("roomId");
  });

  it("returns 404 when schema not found", async () => {
    mockServerGetDocumentById.mockResolvedValue(null);

    const response = await GET(createRequest("GET"), { params });
    const { data, status } = await parseJson(response);

    expect(status).toBe(404);
    expect(data.error).toContain("Schema not found");
  });
});

describe("PUT /api/tenantSchema/[tenant]", () => {
  it("returns 401 when unauthenticated", async () => {
    mockRequireSuperAdmin.mockResolvedValue({
      error: NextResponse.json(
        { error: "Authentication required" },
        { status: 401 },
      ),
    });

    const response = await PUT(createRequest("PUT", mockSchema), { params });
    const { data, status } = await parseJson(response);

    expect(status).toBe(401);
    expect(data.error).toBe("Authentication required");
  });

  it("returns 403 when user is not a super admin", async () => {
    mockRequireSuperAdmin.mockResolvedValue({
      error: NextResponse.json(
        { error: "Super admin permission required" },
        { status: 403 },
      ),
    });

    const response = await PUT(createRequest("PUT", mockSchema), { params });
    const { data, status } = await parseJson(response);

    expect(status).toBe(403);
    expect(data.error).toBe("Super admin permission required");
  });

  it("returns 400 when the body cannot be coerced (poison-save guard)", async () => {
    const poison = { resources: [{ resourceId: "a,b" }] };

    const response = await PUT(createRequest("PUT", poison), { params });
    const { data, status } = await parseJson(response);

    expect(status).toBe(400);
    expect(data.error).toContain("Invalid schema");
    // Must not have written anything.
    expect(mockServerSaveDataToFirestoreWithId).not.toHaveBeenCalled();
  });

  it("saves schema and creates backup for super admin", async () => {
    mockServerGetDocumentById.mockResolvedValue(mockSchema);
    mockFirestoreSet.mockResolvedValue(undefined);
    mockServerSaveDataToFirestoreWithId.mockResolvedValue(undefined);

    const updatedSchema = { ...mockSchema, name: "Updated Name" };

    const response = await PUT(createRequest("PUT", updatedSchema), { params });
    const { data, status } = await parseJson(response);

    expect(status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.backupCreated).toBe(true);

    expect(mockFirestoreCollection).toHaveBeenCalledWith("tenantSchemaBackup");
    expect(mockFirestoreDoc).toHaveBeenCalledWith(
      expect.stringContaining("mc-backup-ui-edit-"),
    );
    expect(mockFirestoreSet).toHaveBeenCalledWith(mockSchema, { merge: false });

    expect(mockServerSaveDataToFirestoreWithId).toHaveBeenCalledWith(
      "tenantSchema",
      "mc",
      { ...updatedSchema, tenantId: "mc" },
    );
  });

  it("skips backup when no existing schema", async () => {
    mockServerGetDocumentById.mockResolvedValue(null);
    mockServerSaveDataToFirestoreWithId.mockResolvedValue(undefined);

    const response = await PUT(createRequest("PUT", mockSchema), { params });
    const { data, status } = await parseJson(response);

    expect(status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.backupCreated).toBe(false);
    expect(mockFirestoreCollection).not.toHaveBeenCalled();
    expect(mockServerSaveDataToFirestoreWithId).toHaveBeenCalled();
  });

  it("returns 400 for invalid tenant", async () => {
    const invalidParams = Promise.resolve({ tenant: "invalid_tenant" });

    const response = await PUT(createRequest("PUT", mockSchema), {
      params: invalidParams,
    });
    const { data, status } = await parseJson(response);

    expect(status).toBe(400);
    expect(data.error).toContain("Invalid tenant");
  });

  it("enforces tenantId from URL param", async () => {
    mockServerGetDocumentById.mockResolvedValue(null);
    mockServerSaveDataToFirestoreWithId.mockResolvedValue(undefined);

    const schemaWithWrongTenantId = { ...mockSchema, tenantId: "wrong" };

    const response = await PUT(createRequest("PUT", schemaWithWrongTenantId), {
      params,
    });
    const { status } = await parseJson(response);

    expect(status).toBe(200);
    expect(mockServerSaveDataToFirestoreWithId).toHaveBeenCalledWith(
      "tenantSchema",
      "mc",
      expect.objectContaining({ tenantId: "mc" }),
    );
  });
});
