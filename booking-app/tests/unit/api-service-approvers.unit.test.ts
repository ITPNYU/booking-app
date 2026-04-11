import { beforeEach, describe, expect, it, vi } from "vitest";

const mockServerGetDocumentById = vi.fn();
const mockServerSaveDataToFirestoreWithId = vi.fn();
const mockServerFetchAllDataFromCollection = vi.fn();

vi.mock("@/lib/firebase/server/adminDb", () => ({
  serverGetDocumentById: (...args: any[]) => mockServerGetDocumentById(...args),
  serverSaveDataToFirestoreWithId: (...args: any[]) =>
    mockServerSaveDataToFirestoreWithId(...args),
  serverFetchAllDataFromCollection: (...args: any[]) =>
    mockServerFetchAllDataFromCollection(...args),
}));

vi.mock("@/components/src/constants/tenants", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/components/src/constants/tenants")>();
  return {
    ...actual,
    isValidTenant: (tenant: string) => ["mc", "itp", "mediaCommons"].includes(tenant),
  };
});

import { POST } from "@/app/api/tenantSchema/[tenant]/serviceApprovers/route";
import { NextRequest } from "next/server";

const BASE_URL = "http://localhost:3000/api/tenantSchema/mc/serviceApprovers";

const createRequest = (body?: any, headers: Record<string, string> = {}) =>
  new NextRequest(BASE_URL, {
    method: "POST",
    headers: new Headers({ "Content-Type": "application/json", ...headers }),
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

const params = Promise.resolve({ tenant: "mc" });

const parseJson = async (response: Response) => ({
  data: await response.json(),
  status: response.status,
});

const mockAdminUser = { email: "admin@nyu.edu", isAdmin: true };
const mockSuperAdmin = { email: "super@nyu.edu" };

/** Set up auth mocks: first call = usersRights, second call = superAdmins */
const mockAsAdmin = () => {
  mockServerFetchAllDataFromCollection
    .mockResolvedValueOnce([mockAdminUser]) // usersRights
    .mockResolvedValueOnce([]); // superAdmins
};

const mockAsSuperAdmin = () => {
  mockServerFetchAllDataFromCollection
    .mockResolvedValueOnce([]) // usersRights (not admin)
    .mockResolvedValueOnce([mockSuperAdmin]); // superAdmins
};

const mockAsUnprivileged = () => {
  mockServerFetchAllDataFromCollection
    .mockResolvedValueOnce([{ email: "user@nyu.edu", isAdmin: false }]) // usersRights
    .mockResolvedValueOnce([]); // superAdmins
};

const mockSchema = {
  tenant: "mc",
  resources: [
    {
      name: "Room 1",
      roomId: 101,
      services: [
        { type: "equipment", approvers: ["existing@nyu.edu"] },
        { type: "staffing", approvers: [] },
      ],
      approvers: ["resource-approver@nyu.edu"],
    },
  ],
};

// ─── Auth / validation ────────────────────────────────────────────────────────

describe("POST /api/tenantSchema/[tenant]/serviceApprovers — auth & validation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 400 for invalid tenant", async () => {
    const { data, status } = await parseJson(
      await POST(createRequest({}, { "x-user-email": "admin@nyu.edu" }), {
        params: Promise.resolve({ tenant: "bad_tenant" }),
      }),
    );
    expect(status).toBe(400);
    expect(data.error).toContain("Invalid tenant");
  });

  it("returns 401 when x-user-email header is missing", async () => {
    const { data, status } = await parseJson(await POST(createRequest(), { params }));
    expect(status).toBe(401);
    expect(data.error).toBe("Authentication required");
  });

  it("returns 403 when user is neither admin nor super admin", async () => {
    mockAsUnprivileged();
    const { data, status } = await parseJson(
      await POST(createRequest({}, { "x-user-email": "user@nyu.edu" }), { params }),
    );
    expect(status).toBe(403);
    expect(data.error).toBe("Admin permission required");
  });

  it("returns 400 when resourceRoomId is missing", async () => {
    mockAsAdmin();
    const { data, status } = await parseJson(
      await POST(
        createRequest(
          { email: "a@nyu.edu", action: "add" },
          { "x-user-email": "admin@nyu.edu" },
        ),
        { params },
      ),
    );
    expect(status).toBe(400);
    expect(data.error).toContain("resourceRoomId");
  });

  it("returns 400 when resourceRoomId is a string (not a number)", async () => {
    mockAsAdmin();
    const { data, status } = await parseJson(
      await POST(
        createRequest(
          { resourceRoomId: "101", email: "a@nyu.edu", action: "add" },
          { "x-user-email": "admin@nyu.edu" },
        ),
        { params },
      ),
    );
    expect(status).toBe(400);
    expect(data.error).toContain("resourceRoomId");
  });

  it("accepts resourceRoomId of 0 (falsy but valid number)", async () => {
    mockAsAdmin();
    mockServerGetDocumentById.mockResolvedValue({
      tenant: "mc",
      resources: [{ name: "Room 0", roomId: 0, services: [], approvers: [] }],
    });
    mockServerSaveDataToFirestoreWithId.mockResolvedValue(undefined);

    const { status } = await parseJson(
      await POST(
        createRequest(
          { resourceRoomId: 0, email: "a@nyu.edu", action: "add" },
          { "x-user-email": "admin@nyu.edu" },
        ),
        { params },
      ),
    );
    expect(status).toBe(200);
  });

  it("returns 400 when action is invalid", async () => {
    mockAsAdmin();
    const { data, status } = await parseJson(
      await POST(
        createRequest(
          { resourceRoomId: 101, email: "a@nyu.edu", action: "upsert" },
          { "x-user-email": "admin@nyu.edu" },
        ),
        { params },
      ),
    );
    expect(status).toBe(400);
    expect(data.error).toContain("action");
  });
});

// ─── Not-found cases ──────────────────────────────────────────────────────────

describe("POST /api/tenantSchema/[tenant]/serviceApprovers — not found", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 404 when tenant schema is missing", async () => {
    mockAsAdmin();
    mockServerGetDocumentById.mockResolvedValue(null);

    const { data, status } = await parseJson(
      await POST(
        createRequest(
          { resourceRoomId: 101, serviceType: "equipment", email: "a@nyu.edu", action: "add" },
          { "x-user-email": "admin@nyu.edu" },
        ),
        { params },
      ),
    );
    expect(status).toBe(404);
    expect(data.error).toContain("Schema not found");
  });

  it("returns 404 when resource roomId does not match", async () => {
    mockAsAdmin();
    mockServerGetDocumentById.mockResolvedValue(mockSchema);

    const { data, status } = await parseJson(
      await POST(
        createRequest(
          { resourceRoomId: 999, serviceType: "equipment", email: "a@nyu.edu", action: "add" },
          { "x-user-email": "admin@nyu.edu" },
        ),
        { params },
      ),
    );
    expect(status).toBe(404);
    expect(data.error).toContain("999");
  });

  it("returns 404 when serviceType is not on the resource", async () => {
    mockAsAdmin();
    mockServerGetDocumentById.mockResolvedValue(mockSchema);

    const { data, status } = await parseJson(
      await POST(
        createRequest(
          { resourceRoomId: 101, serviceType: "catering", email: "a@nyu.edu", action: "add" },
          { "x-user-email": "admin@nyu.edu" },
        ),
        { params },
      ),
    );
    expect(status).toBe(404);
    expect(data.error).toContain("catering");
  });
});

// ─── Per-service approvers ────────────────────────────────────────────────────

describe("POST /api/tenantSchema/[tenant]/serviceApprovers — per-service add/remove", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockServerSaveDataToFirestoreWithId.mockResolvedValue(undefined);
  });

  it("adds an approver to a service and saves the schema", async () => {
    mockAsAdmin();
    mockServerGetDocumentById.mockResolvedValue(mockSchema);

    const { data, status } = await parseJson(
      await POST(
        createRequest(
          { resourceRoomId: 101, serviceType: "equipment", email: "new@nyu.edu", action: "add" },
          { "x-user-email": "admin@nyu.edu" },
        ),
        { params },
      ),
    );
    expect(status).toBe(200);
    expect(data.success).toBe(true);

    const savedSchema = mockServerSaveDataToFirestoreWithId.mock.calls[0][2];
    const equipment = savedSchema.resources[0].services.find((s: any) => s.type === "equipment");
    expect(equipment.approvers).toContain("new@nyu.edu");
    expect(equipment.approvers).toContain("existing@nyu.edu");
  });

  it("returns 409 when approver email already exists for that service", async () => {
    mockAsAdmin();
    mockServerGetDocumentById.mockResolvedValue(mockSchema);

    const { data, status } = await parseJson(
      await POST(
        createRequest(
          { resourceRoomId: 101, serviceType: "equipment", email: "existing@nyu.edu", action: "add" },
          { "x-user-email": "admin@nyu.edu" },
        ),
        { params },
      ),
    );
    expect(status).toBe(409);
    expect(data.error).toContain("already an approver");
    expect(mockServerSaveDataToFirestoreWithId).not.toHaveBeenCalled();
  });

  it("duplicate check is case-insensitive", async () => {
    mockAsAdmin();
    mockServerGetDocumentById.mockResolvedValue(mockSchema);

    const { status } = await parseJson(
      await POST(
        createRequest(
          { resourceRoomId: 101, serviceType: "equipment", email: "EXISTING@NYU.EDU", action: "add" },
          { "x-user-email": "admin@nyu.edu" },
        ),
        { params },
      ),
    );
    expect(status).toBe(409);
  });

  it("removes an approver from a service", async () => {
    mockAsAdmin();
    mockServerGetDocumentById.mockResolvedValue(mockSchema);

    const { data, status } = await parseJson(
      await POST(
        createRequest(
          { resourceRoomId: 101, serviceType: "equipment", email: "existing@nyu.edu", action: "remove" },
          { "x-user-email": "admin@nyu.edu" },
        ),
        { params },
      ),
    );
    expect(status).toBe(200);
    expect(data.success).toBe(true);

    const savedSchema = mockServerSaveDataToFirestoreWithId.mock.calls[0][2];
    const equipment = savedSchema.resources[0].services.find((s: any) => s.type === "equipment");
    expect(equipment.approvers).not.toContain("existing@nyu.edu");
  });

  it("handles services with null/undefined entries gracefully (malformed Firestore data)", async () => {
    mockAsAdmin();
    mockServerGetDocumentById.mockResolvedValue({
      ...mockSchema,
      resources: [
        {
          ...mockSchema.resources[0],
          services: [null, undefined, { type: "equipment", approvers: [] }],
        },
      ],
    });

    const { data, status } = await parseJson(
      await POST(
        createRequest(
          { resourceRoomId: 101, serviceType: "equipment", email: "new@nyu.edu", action: "add" },
          { "x-user-email": "admin@nyu.edu" },
        ),
        { params },
      ),
    );
    expect(status).toBe(200);
    expect(data.success).toBe(true);
  });

  it("allows super admin (not tenant admin) to add an approver", async () => {
    mockAsSuperAdmin();
    mockServerGetDocumentById.mockResolvedValue(mockSchema);

    const { status } = await parseJson(
      await POST(
        createRequest(
          { resourceRoomId: 101, serviceType: "staffing", email: "new@nyu.edu", action: "add" },
          { "x-user-email": "super@nyu.edu" },
        ),
        { params },
      ),
    );
    expect(status).toBe(200);
  });
});

// ─── Resource-level approvers (no serviceType) ────────────────────────────────

describe("POST /api/tenantSchema/[tenant]/serviceApprovers — resource-level add/remove", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockServerSaveDataToFirestoreWithId.mockResolvedValue(undefined);
  });

  it("adds a resource-level approver when no serviceType is provided", async () => {
    mockAsAdmin();
    mockServerGetDocumentById.mockResolvedValue(mockSchema);

    const { data, status } = await parseJson(
      await POST(
        createRequest(
          { resourceRoomId: 101, email: "new@nyu.edu", action: "add" },
          { "x-user-email": "admin@nyu.edu" },
        ),
        { params },
      ),
    );
    expect(status).toBe(200);
    expect(data.success).toBe(true);

    const savedSchema = mockServerSaveDataToFirestoreWithId.mock.calls[0][2];
    expect(savedSchema.resources[0].approvers).toContain("new@nyu.edu");
    expect(savedSchema.resources[0].approvers).toContain("resource-approver@nyu.edu");
  });

  it("returns 409 when resource-level approver already exists", async () => {
    mockAsAdmin();
    mockServerGetDocumentById.mockResolvedValue(mockSchema);

    const { data, status } = await parseJson(
      await POST(
        createRequest(
          { resourceRoomId: 101, email: "resource-approver@nyu.edu", action: "add" },
          { "x-user-email": "admin@nyu.edu" },
        ),
        { params },
      ),
    );
    expect(status).toBe(409);
    expect(data.error).toContain("already an approver");
  });

  it("removes a resource-level approver", async () => {
    mockAsAdmin();
    mockServerGetDocumentById.mockResolvedValue(mockSchema);

    const { data, status } = await parseJson(
      await POST(
        createRequest(
          { resourceRoomId: 101, email: "resource-approver@nyu.edu", action: "remove" },
          { "x-user-email": "admin@nyu.edu" },
        ),
        { params },
      ),
    );
    expect(status).toBe(200);

    const savedSchema = mockServerSaveDataToFirestoreWithId.mock.calls[0][2];
    expect(savedSchema.resources[0].approvers).not.toContain("resource-approver@nyu.edu");
  });
});
