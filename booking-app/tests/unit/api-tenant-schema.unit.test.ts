import { beforeEach, describe, expect, it, vi } from "vitest";

const mockServerGetDocumentById = vi.fn();
const mockServerSaveDataToFirestoreWithId = vi.fn();
const mockServerFetchAllDataFromCollection = vi.fn();
const mockFirestoreSet = vi.fn();
const mockFirestoreDoc = vi.fn(() => ({ set: mockFirestoreSet }));
const mockFirestoreCollection = vi.fn(() => ({ doc: mockFirestoreDoc }));

vi.mock("@/lib/firebase/server/adminDb", () => ({
  serverGetDocumentById: (...args: any[]) =>
    mockServerGetDocumentById(...args),
  serverSaveDataToFirestoreWithId: (...args: any[]) =>
    mockServerSaveDataToFirestoreWithId(...args),
  serverFetchAllDataFromCollection: (...args: any[]) =>
    mockServerFetchAllDataFromCollection(...args),
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
  const actual = await importOriginal<typeof import("@/components/src/constants/tenants")>();
  return {
    ...actual,
    isValidTenant: (tenant: string) => ["mc", "itp", "mediaCommons"].includes(tenant),
  };
});

import { GET, PUT } from "@/app/api/tenantSchema/[tenant]/route";
import { NextRequest } from "next/server";

const createRequest = (
  method: string,
  body?: any,
  headers: Record<string, string> = {},
) => {
  const req = new NextRequest("http://localhost:3000/api/tenantSchema/mc", {
    method,
    headers: new Headers({
      "Content-Type": "application/json",
      ...headers,
    }),
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  return req;
};

const params = Promise.resolve({ tenant: "mc" });

const parseJson = async (response: Response) => {
  const data = await response.json();
  return { data, status: response.status };
};

const mockSchema = {
  tenant: "mc",
  name: "Media Commons",
  showEquipment: true,
  resources: [{ name: "Room 1", roomId: 1 }],
};

describe("GET /api/tenantSchema/[tenant]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns schema when found", async () => {
    mockServerGetDocumentById.mockResolvedValue(mockSchema);

    const response = await GET(createRequest("GET"), { params });
    const { data, status } = await parseJson(response);

    expect(status).toBe(200);
    expect(data.name).toBe("Media Commons");
    expect(data.resources).toHaveLength(1);
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
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when no x-user-email header", async () => {
    const response = await PUT(createRequest("PUT", mockSchema), {
      params,
    });
    const { data, status } = await parseJson(response);

    expect(status).toBe(401);
    expect(data.error).toBe("Authentication required");
  });

  it("returns 403 when user is not a super admin", async () => {
    mockServerFetchAllDataFromCollection.mockResolvedValue([
      { id: "1", email: "admin@nyu.edu" },
    ]);

    const response = await PUT(
      createRequest("PUT", mockSchema, {
        "x-user-email": "notadmin@nyu.edu",
      }),
      { params },
    );
    const { data, status } = await parseJson(response);

    expect(status).toBe(403);
    expect(data.error).toBe("Super admin permission required");
  });

  it("saves schema and creates backup for super admin", async () => {
    mockServerFetchAllDataFromCollection.mockResolvedValue([
      { id: "1", email: "admin@nyu.edu" },
    ]);
    mockServerGetDocumentById.mockResolvedValue(mockSchema);
    mockFirestoreSet.mockResolvedValue(undefined);
    mockServerSaveDataToFirestoreWithId.mockResolvedValue(undefined);

    const updatedSchema = { ...mockSchema, name: "Updated Name" };

    const response = await PUT(
      createRequest("PUT", updatedSchema, {
        "x-user-email": "admin@nyu.edu",
      }),
      { params },
    );
    const { data, status } = await parseJson(response);

    expect(status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.backupCreated).toBe(true);

    // Verify backup was created
    expect(mockFirestoreCollection).toHaveBeenCalledWith(
      "tenantSchemaBackup",
    );
    expect(mockFirestoreDoc).toHaveBeenCalledWith(
      expect.stringContaining("mc-backup-ui-edit-"),
    );
    expect(mockFirestoreSet).toHaveBeenCalledWith(mockSchema, {
      merge: false,
    });

    // Verify schema was saved
    expect(mockServerSaveDataToFirestoreWithId).toHaveBeenCalledWith(
      "tenantSchema",
      "mc",
      updatedSchema,
    );
  });

  it("skips backup when no existing schema", async () => {
    mockServerFetchAllDataFromCollection.mockResolvedValue([
      { id: "1", email: "admin@nyu.edu" },
    ]);
    mockServerGetDocumentById.mockResolvedValue(null);
    mockServerSaveDataToFirestoreWithId.mockResolvedValue(undefined);

    const response = await PUT(
      createRequest("PUT", mockSchema, {
        "x-user-email": "admin@nyu.edu",
      }),
      { params },
    );
    const { data, status } = await parseJson(response);

    expect(status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.backupCreated).toBe(false);

    // Backup should NOT have been created
    expect(mockFirestoreCollection).not.toHaveBeenCalled();

    // Schema should still be saved
    expect(mockServerSaveDataToFirestoreWithId).toHaveBeenCalled();
  });

  it("returns 400 for invalid tenant", async () => {
    const invalidParams = Promise.resolve({ tenant: "invalid_tenant" });

    const response = await PUT(
      createRequest("PUT", mockSchema, {
        "x-user-email": "admin@nyu.edu",
      }),
      { params: invalidParams },
    );
    const { data, status } = await parseJson(response);

    expect(status).toBe(400);
    expect(data.error).toContain("Invalid tenant");
  });

  it("enforces tenant field from URL param", async () => {
    mockServerFetchAllDataFromCollection.mockResolvedValue([
      { id: "1", email: "admin@nyu.edu" },
    ]);
    mockServerGetDocumentById.mockResolvedValue(null);
    mockServerSaveDataToFirestoreWithId.mockResolvedValue(undefined);

    const schemaWithWrongTenant = { ...mockSchema, tenant: "wrong" };

    const response = await PUT(
      createRequest("PUT", schemaWithWrongTenant, {
        "x-user-email": "admin@nyu.edu",
      }),
      { params },
    );
    const { status } = await parseJson(response);

    expect(status).toBe(200);
    // Verify the saved schema has tenant = "mc" (from URL), not "wrong"
    expect(mockServerSaveDataToFirestoreWithId).toHaveBeenCalledWith(
      "tenantSchema",
      "mc",
      expect.objectContaining({ tenant: "mc" }),
    );
  });

  it("email comparison is case-insensitive", async () => {
    mockServerFetchAllDataFromCollection.mockResolvedValue([
      { id: "1", email: "Admin@NYU.edu" },
    ]);
    mockServerGetDocumentById.mockResolvedValue(null);
    mockServerSaveDataToFirestoreWithId.mockResolvedValue(undefined);

    const response = await PUT(
      createRequest("PUT", mockSchema, {
        "x-user-email": "admin@nyu.edu",
      }),
      { params },
    );
    const { status } = await parseJson(response);

    expect(status).toBe(200);
  });
});
