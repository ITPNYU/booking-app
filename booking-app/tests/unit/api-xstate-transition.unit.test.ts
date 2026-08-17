import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/stateMachines/xstateUtilsV5", () => ({
  executeXStateTransition: vi.fn(),
  getAvailableXStateTransitions: vi.fn(),
}));

vi.mock("@/lib/api/requireSession", () => ({
  requireSession: vi.fn(),
}));

vi.mock("@/lib/utils/testEnvironment", () => ({
  shouldBypassAuth: vi.fn(),
}));

import { POST } from "@/app/api/xstate-transition/route";
import { requireSession } from "@/lib/api/requireSession";
import { executeXStateTransition } from "@/lib/stateMachines/xstateUtilsV5";
import { shouldBypassAuth } from "@/lib/utils/testEnvironment";

const mockExecuteXStateTransition = vi.mocked(executeXStateTransition);
const mockRequireSession = vi.mocked(requireSession);
const mockShouldBypassAuth = vi.mocked(shouldBypassAuth);

const createRequest = (body: Record<string, unknown>) =>
  ({
    json: async () => body,
    headers: new Headers({ "x-tenant": "mc" }),
  }) as any;

describe("POST /api/xstate-transition no-show attribution", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireSession.mockResolvedValue({
      email: "operator@nyu.edu",
      netId: "operator",
    });
    mockShouldBypassAuth.mockReturnValue(false);
    mockExecuteXStateTransition.mockResolvedValue({
      success: true,
      newState: "Closed",
    });
  });

  it("uses the authenticated operator instead of the student in the body", async () => {
    const response = await POST(
      createRequest({
        calendarEventId: "calendar-123",
        eventType: "noShow",
        email: "student@nyu.edu",
        netId: "student",
      }),
    );

    expect(response.status).toBe(200);
    expect(mockExecuteXStateTransition).toHaveBeenCalledWith(
      "calendar-123",
      "noShow",
      "mc",
      "operator@nyu.edu",
      undefined,
      "operator",
    );
  });

  it("retains an explicit mocked operator identity during E2E auth bypass", async () => {
    mockShouldBypassAuth.mockReturnValue(true);

    await POST(
      createRequest({
        calendarEventId: "calendar-123",
        eventType: "noShow",
        email: "e2e-operator@nyu.edu",
        netId: "e2e-operator",
      }),
    );

    expect(mockExecuteXStateTransition).toHaveBeenCalledWith(
      "calendar-123",
      "noShow",
      "mc",
      "e2e-operator@nyu.edu",
      undefined,
      "e2e-operator",
    );
  });

  it("rejects an unauthenticated no-show transition", async () => {
    mockRequireSession.mockResolvedValue(null);

    const response = await POST(
      createRequest({
        calendarEventId: "calendar-123",
        eventType: "noShow",
        email: "student@nyu.edu",
      }),
    );

    expect(response.status).toBe(401);
    expect(mockExecuteXStateTransition).not.toHaveBeenCalled();
  });
});
