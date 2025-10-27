import { GET } from "@/app/api/user-tenant-access/route";
import * as adminDb from "@/lib/firebase/server/adminDb";
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock tenant schemas
const mockMcSchema = {
  tenant: "mc",
  programMapping: {
    "General Department": ["GENERAL", "OTHER"],
    "Media Commons": ["MC", "370J"],
  },
};

const mockItpSchema = {
  tenant: "itp",
  programMapping: {
    "ITP / IMA / Low Res": ["ITP", "TISCH-ITP"],
  },
};

vi.mock("@/lib/firebase/server/adminDb");

describe("User Tenant Access API", () => {
  beforeEach(() => {
    vi.resetAllMocks();

    // Mock serverGetDocumentById to return tenant schemas
    vi.mocked(adminDb.serverGetDocumentById).mockImplementation(
      async (collection: string, docId: string) => {
        if (docId === "mc") return mockMcSchema;
        if (docId === "itp") return mockItpSchema;
        return null;
      }
    );
  });

  it("should grant ITP access to ITP department users", async () => {
    // Mock fetch to return ITP user data
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        dept_name: "Interactive Telecommunications Program",
        dept_code: "TISCH-ITP",
        reporting_dept_code: "ITP",
        school_name: "Tisch School of the Arts",
      }),
    });

    const request = new NextRequest(
      "http://localhost:3000/api/user-tenant-access?netId=test123"
    );
    const response = await GET(request);
    const data = await response.json();

    expect(data.tenants).toContain("itp");
    expect(data.userInfo.dept_name).toBe(
      "Interactive Telecommunications Program"
    );
    expect(data.userInfo.mapped_department).toBe("ITP / IMA / Low Res");
  });

  it("should grant both MC and ITP access when user maps to both", async () => {
    // Update mock to include user in both programMappings
    const extendedMcSchema = {
      ...mockMcSchema,
      programMapping: {
        ...mockMcSchema.programMapping,
        "ITP / IMA / Low Res": ["ITP"],
      },
    };

    vi.mocked(adminDb.serverGetDocumentById).mockImplementation(
      async (collection: string, docId: string) => {
        if (docId === "mc") return extendedMcSchema;
        if (docId === "itp") return mockItpSchema;
        return null;
      }
    );

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        dept_name: "Interactive Telecommunications Program",
        reporting_dept_code: "ITP",
        school_name: "Tisch School of the Arts",
      }),
    });

    const request = new NextRequest(
      "http://localhost:3000/api/user-tenant-access?netId=test456"
    );
    const response = await GET(request);
    const data = await response.json();

    expect(data.tenants).toContain("mc");
    expect(data.tenants).toContain("itp");
  });

  it("should grant MC access to users with GENERAL department code", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        dept_name: "Some Department",
        reporting_dept_code: "GENERAL",
        school_name: "NYU",
      }),
    });

    const request = new NextRequest(
      "http://localhost:3000/api/user-tenant-access?netId=test789"
    );
    const response = await GET(request);
    const data = await response.json();

    // User with GENERAL code maps to MC but not ITP
    expect(data.tenants).toContain("mc");
    expect(data.tenants).not.toContain("itp");
    expect(data.userInfo.mapped_department).toBe("General Department");
  });

  it("should grant access to all tenants for users without programMapping match", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        dept_name: "Some Other Department",
        reporting_dept_code: "UNKNOWN",
        school_name: "NYU",
      }),
    });

    const request = new NextRequest(
      "http://localhost:3000/api/user-tenant-access?netId=test999"
    );
    const response = await GET(request);
    const data = await response.json();

    // Users without programMapping matches should get access to all tenants
    expect(data.tenants).toContain("mc");
    expect(data.tenants).toContain("itp");
    expect(data.userInfo.mapped_department).toBeUndefined();
  });

  it("should return 400 if netId is not provided", async () => {
    const request = new NextRequest(
      "http://localhost:3000/api/user-tenant-access"
    );
    const response = await GET(request);

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toBe("NetID is required");
  });

  it("should handle NYU Identity API failures gracefully", async () => {
    // Mock fetch to return error
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
    });

    const request = new NextRequest(
      "http://localhost:3000/api/user-tenant-access?netId=test123"
    );
    const response = await GET(request);
    const data = await response.json();

    // Should return both tenants on API failure
    expect(data.tenants).toContain("mc");
    expect(data.tenants).toContain("itp");
    expect(data.error).toContain("NYU Identity API call failed");
  });

  it("should handle missing tenant schemas gracefully", async () => {
    // Mock serverGetDocumentById to return null
    vi.mocked(adminDb.serverGetDocumentById).mockResolvedValue(null);

    const request = new NextRequest(
      "http://localhost:3000/api/user-tenant-access?netId=test123"
    );
    const response = await GET(request);
    const data = await response.json();

    // Should return both tenants when schemas are not available
    expect(data.tenants).toContain("mc");
    expect(data.tenants).toContain("itp");
    expect(data.error).toContain("Tenant schemas not available");
  });

  it("should be case insensitive when matching department codes", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        dept_name: "Interactive Telecommunications Program",
        reporting_dept_code: "itp", // lowercase
        school_name: "Tisch School of the Arts",
      }),
    });

    const request = new NextRequest(
      "http://localhost:3000/api/user-tenant-access?netId=test123"
    );
    const response = await GET(request);
    const data = await response.json();

    expect(data.tenants).toContain("itp");
  });

  it("should handle users with no reporting_dept_code", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        dept_name: "Some Department",
        school_name: "NYU",
        // no reporting_dept_code
      }),
    });

    const request = new NextRequest(
      "http://localhost:3000/api/user-tenant-access?netId=test123"
    );
    const response = await GET(request);
    const data = await response.json();

    // Users without dept code should get access to both tenants
    expect(data.tenants).toContain("mc");
    expect(data.tenants).toContain("itp");
  });
});
