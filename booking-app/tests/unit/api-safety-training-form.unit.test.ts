import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock environment variables
vi.stubEnv("NEXT_PUBLIC_GCP_LOG_NAME", "test-log");
vi.stubEnv("NEXT_PUBLIC_BRANCH_NAME", "test-branch");

// Mock dependencies before importing the route
vi.mock("@/lib/googleClient", () => ({
  getFormsClient: vi.fn(),
  getLoggingClient: vi.fn(),
}));

vi.mock("@/lib/firebase/server/adminDb", () => ({
  serverGetDocumentById: vi.fn(),
}));

import { GET } from "@/app/api/safety_training_form/route";
import { getFormsClient, getLoggingClient } from "@/lib/googleClient";
import { serverGetDocumentById } from "@/lib/firebase/server/adminDb";

const mockGetFormsClient = vi.mocked(getFormsClient);
const mockGetLoggingClient = vi.mocked(getLoggingClient);
const mockServerGetDocumentById = vi.mocked(serverGetDocumentById);

const createRequest = (headers: Record<string, string> = {}) => ({
  headers: new Headers(headers),
});

const parseJson = async (response: Response) => {
  const data = await response.json();
  return { data, status: response.status };
};

describe("GET /api/safety_training_form", () => {
  const mockListResponses = vi.fn();
  const mockLogWrite = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    // Set up default mocks
    mockGetFormsClient.mockResolvedValue({
      forms: {
        responses: {
          list: mockListResponses,
        },
      },
    } as any);

    mockGetLoggingClient.mockResolvedValue({
      entries: {
        write: mockLogWrite,
      },
    } as any);

    mockLogWrite.mockResolvedValue({});
  });

  it("returns 400 when tenant header is missing", async () => {
    const request = createRequest({});

    const response = await GET(request as any);
    const result = await parseJson(response);

    expect(result.status).toBe(400);
    expect(result.data).toEqual({ error: "Tenant header is required" });
  });

  it("returns 404 when tenant schema is not found", async () => {
    mockServerGetDocumentById.mockResolvedValue(null);

    const request = createRequest({ "x-tenant": "unknown-tenant" });

    const response = await GET(request as any);
    const result = await parseJson(response);

    expect(result.status).toBe(404);
    expect(result.data).toEqual({ error: "Tenant schema not found" });
  });

  it("returns 404 when safety training form is not configured", async () => {
    mockServerGetDocumentById.mockResolvedValue({
      name: "Test Tenant",
      // No safetyTrainingGoogleFormId
    });

    const request = createRequest({ "x-tenant": "test-tenant" });

    const response = await GET(request as any);
    const result = await parseJson(response);

    expect(result.status).toBe(404);
    expect(result.data).toEqual({
      error: "No training form configured for this resource",
    });
  });

  it("returns emails from form responses successfully", async () => {
    mockServerGetDocumentById.mockResolvedValue({
      name: "Test Tenant",
      safetyTrainingGoogleFormId: "form-123",
    });

    mockListResponses.mockResolvedValue({
      data: {
        responses: [
          { respondentEmail: "user1@nyu.edu" },
          { respondentEmail: "user2@nyu.edu" },
          { respondentEmail: "user3@nyu.edu" },
        ],
      },
    });

    const request = createRequest({ "x-tenant": "test-tenant" });

    const response = await GET(request as any);
    const result = await parseJson(response);

    expect(result.status).toBe(200);
    expect(result.data).toEqual({
      emails: ["user1@nyu.edu", "user2@nyu.edu", "user3@nyu.edu"],
    });

    // Verify form API was called with correct form ID
    expect(mockListResponses).toHaveBeenCalledWith({
      formId: "form-123",
    });

    // Verify logging was called
    expect(mockLogWrite).toHaveBeenCalled();
  });

  it("filters out invalid emails from responses", async () => {
    mockServerGetDocumentById.mockResolvedValue({
      name: "Test Tenant",
      safetyTrainingGoogleFormId: "form-123",
    });

    mockListResponses.mockResolvedValue({
      data: {
        responses: [
          { respondentEmail: "valid@nyu.edu" },
          { respondentEmail: null },
          { respondentEmail: undefined },
          { respondentEmail: "" },
          { respondentEmail: "invalid-no-at-sign" },
          { respondentEmail: "another@valid.com" },
        ],
      },
    });

    const request = createRequest({ "x-tenant": "test-tenant" });

    const response = await GET(request as any);
    const result = await parseJson(response);

    expect(result.status).toBe(200);
    expect(result.data).toEqual({
      emails: ["valid@nyu.edu", "another@valid.com"],
    });
  });

  it("returns empty array when no form responses exist", async () => {
    mockServerGetDocumentById.mockResolvedValue({
      name: "Test Tenant",
      safetyTrainingGoogleFormId: "form-123",
    });

    mockListResponses.mockResolvedValue({
      data: {
        responses: null,
      },
    });

    const request = createRequest({ "x-tenant": "test-tenant" });

    const response = await GET(request as any);
    const result = await parseJson(response);

    expect(result.status).toBe(200);
    expect(result.data).toEqual({ emails: [] });
  });

  it("returns empty array when responses array is empty", async () => {
    mockServerGetDocumentById.mockResolvedValue({
      name: "Test Tenant",
      safetyTrainingGoogleFormId: "form-123",
    });

    mockListResponses.mockResolvedValue({
      data: {
        responses: [],
      },
    });

    const request = createRequest({ "x-tenant": "test-tenant" });

    const response = await GET(request as any);
    const result = await parseJson(response);

    expect(result.status).toBe(200);
    expect(result.data).toEqual({ emails: [] });
  });

  it("includes resourceId in logging when provided", async () => {
    mockServerGetDocumentById.mockResolvedValue({
      name: "Test Tenant",
      safetyTrainingGoogleFormId: "form-123",
    });

    mockListResponses.mockResolvedValue({
      data: {
        responses: [{ respondentEmail: "user@nyu.edu" }],
      },
    });

    const request = createRequest({
      "x-tenant": "test-tenant",
      "x-resource-id": "resource-456",
    });

    const response = await GET(request as any);

    expect(response.status).toBe(200);
    expect(mockLogWrite).toHaveBeenCalledWith({
      requestBody: expect.objectContaining({
        entries: [
          expect.objectContaining({
            jsonPayload: expect.objectContaining({
              resourceId: "resource-456",
            }),
          }),
        ],
      }),
    });
  });

  it("sets correct cache control headers", async () => {
    mockServerGetDocumentById.mockResolvedValue({
      name: "Test Tenant",
      safetyTrainingGoogleFormId: "form-123",
    });

    mockListResponses.mockResolvedValue({
      data: {
        responses: [],
      },
    });

    const request = createRequest({ "x-tenant": "test-tenant" });

    const response = await GET(request as any);

    expect(response.headers.get("Cache-Control")).toBe(
      "no-store, no-cache, must-revalidate, proxy-revalidate",
    );
    expect(response.headers.get("Expires")).toBe("0");
  });

  describe("error handling", () => {
    it("returns 401 for invalid_grant authentication errors", async () => {
      mockServerGetDocumentById.mockResolvedValue({
        name: "Test Tenant",
        safetyTrainingGoogleFormId: "form-123",
      });

      mockListResponses.mockRejectedValue(
        new Error("invalid_grant: Token has been expired or revoked"),
      );

      const request = createRequest({ "x-tenant": "test-tenant" });

      const response = await GET(request as any);
      const result = await parseJson(response);

      expect(result.status).toBe(401);
      expect(result.data).toEqual({
        error: "Authentication failed. Please check Google API credentials",
      });
    });

    it("returns 404 for Form not found errors", async () => {
      mockServerGetDocumentById.mockResolvedValue({
        name: "Test Tenant",
        safetyTrainingGoogleFormId: "invalid-form-id",
      });

      mockListResponses.mockRejectedValue(new Error("Form not found"));

      const request = createRequest({ "x-tenant": "test-tenant" });

      const response = await GET(request as any);
      const result = await parseJson(response);

      expect(result.status).toBe(404);
      expect(result.data).toEqual({
        error: "Specified Google Form not found",
      });
    });

    it("returns 403 for permission_denied errors", async () => {
      mockServerGetDocumentById.mockResolvedValue({
        name: "Test Tenant",
        safetyTrainingGoogleFormId: "form-123",
      });

      mockListResponses.mockRejectedValue(
        new Error("permission_denied: User does not have permission"),
      );

      const request = createRequest({ "x-tenant": "test-tenant" });

      const response = await GET(request as any);
      const result = await parseJson(response);

      expect(result.status).toBe(403);
      expect(result.data).toEqual({
        error:
          "Permission denied. Please share the form with the service account",
        details:
          "The service account needs at least Viewer access to the form",
        code: 403,
      });
    });

    it("returns 403 for Insufficient Permission errors", async () => {
      mockServerGetDocumentById.mockResolvedValue({
        name: "Test Tenant",
        safetyTrainingGoogleFormId: "form-123",
      });

      mockListResponses.mockRejectedValue(
        new Error("Insufficient Permission to access resource"),
      );

      const request = createRequest({ "x-tenant": "test-tenant" });

      const response = await GET(request as any);
      const result = await parseJson(response);

      expect(result.status).toBe(403);
      expect(result.data).toEqual({
        error:
          "Permission denied. Please share the form with the service account",
        details:
          "The service account needs at least Viewer access to the form",
        code: 403,
      });
    });

    it("returns 500 for generic errors with details", async () => {
      mockServerGetDocumentById.mockResolvedValue({
        name: "Test Tenant",
        safetyTrainingGoogleFormId: "form-123",
      });

      const error = new Error("Network error") as any;
      error.code = "NETWORK_ERROR";
      mockListResponses.mockRejectedValue(error);

      const request = createRequest({ "x-tenant": "test-tenant" });

      const response = await GET(request as any);
      const result = await parseJson(response);

      expect(result.status).toBe(500);
      expect(result.data).toEqual({
        error: "Failed to fetch form responses",
        details: "Network error",
        code: "NETWORK_ERROR",
      });
    });

    it("returns UNKNOWN code for errors without code property", async () => {
      mockServerGetDocumentById.mockResolvedValue({
        name: "Test Tenant",
        safetyTrainingGoogleFormId: "form-123",
      });

      mockListResponses.mockRejectedValue(new Error("Something went wrong"));

      const request = createRequest({ "x-tenant": "test-tenant" });

      const response = await GET(request as any);
      const result = await parseJson(response);

      expect(result.status).toBe(500);
      expect(result.data).toEqual({
        error: "Failed to fetch form responses",
        details: "Something went wrong",
        code: "UNKNOWN",
      });
    });
  });
});
