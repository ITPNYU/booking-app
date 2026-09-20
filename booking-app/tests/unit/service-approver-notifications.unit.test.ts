import { beforeEach, describe, expect, it, vi } from "vitest";

const mockServerGetDataByCalendarEventId = vi.fn();
const mockServerFetchAllDataFromCollection = vi.fn();
const mockServerBookingContents = vi.fn();
const mockGetTenantEmailConfig = vi.fn();
const mockServerGetTenantResources = vi.fn();

vi.mock("@/lib/firebase/server/adminDb", () => ({
  serverGetDataByCalendarEventId: (...args: any[]) =>
    mockServerGetDataByCalendarEventId(...args),
  serverFetchAllDataFromCollection: (...args: any[]) =>
    mockServerFetchAllDataFromCollection(...args),
}));

vi.mock("@/components/src/server/admin", () => ({
  serverBookingContents: (...args: any[]) => mockServerBookingContents(...args),
}));

vi.mock("@/components/src/server/emails", () => ({
  getTenantEmailConfig: (...args: any[]) => mockGetTenantEmailConfig(...args),
}));

vi.mock("@/lib/tenant/serverGetTenantResources", () => ({
  serverGetTenantResources: (...args: any[]) =>
    mockServerGetTenantResources(...args),
}));

import { notifyServiceApproversForRequestedServices } from "@/components/src/server/serviceApproverNotifications";

const fetchMock = vi.fn();

/** Approver emails that were sent, keyed by the service named in the subject. */
const sentSubjects = () =>
  fetchMock.mock.calls.map(([, init]) => {
    const body = JSON.parse(init.body);
    return `${body.subjectStatusOverride} → ${body.targetEmail}`;
  });

describe("notifyServiceApproversForRequestedServices", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockResolvedValue({ ok: true });
    mockServerGetTenantResources.mockResolvedValue([]);
    mockServerFetchAllDataFromCollection.mockResolvedValue([
      { email: "staff-approver@nyu.edu", isStaffing: true },
      { email: "catering-approver@nyu.edu", isCatering: true },
      { email: "security-approver@nyu.edu", isSecurity: true },
    ]);
    mockServerBookingContents.mockResolvedValue({
      title: "Demo",
      requestNumber: 7,
      email: "requester@nyu.edu",
    });
    mockGetTenantEmailConfig.mockResolvedValue({ schemaName: "Media Commons" });
  });

  it("notifies the approvers of every pending requested service", async () => {
    mockServerGetDataByCalendarEventId.mockResolvedValue({
      staffingServices: "audio_tech",
      catering: "yes",
      hireSecurity: "yes",
    });

    await notifyServiceApproversForRequestedServices("cal-1", "mc");

    expect(sentSubjects().sort()).toEqual([
      "CATERING REQUESTED → catering-approver@nyu.edu",
      "SECURITY REQUESTED → security-approver@nyu.edu",
      "STAFFING REQUESTED → staff-approver@nyu.edu",
    ]);
  });

  it("skips services that already hold a decision after a resubmitted edit", async () => {
    mockServerGetDataByCalendarEventId.mockResolvedValue({
      staffingServices: "audio_tech",
      catering: "yes",
      hireSecurity: "yes",
      staffServiceApproved: true,
      cateringServiceApproved: false,
    });

    await notifyServiceApproversForRequestedServices("cal-1", "mc");

    expect(sentSubjects()).toEqual([
      "SECURITY REQUESTED → security-approver@nyu.edu",
    ]);
  });
});
