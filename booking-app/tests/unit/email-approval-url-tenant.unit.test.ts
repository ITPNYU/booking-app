import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { getApprovalUrl } from "../../app/lib/sendHTMLEmail";
import { DEFAULT_TENANT } from "../../components/src/constants/tenants";
import { ApproverType } from "../../components/src/types";

describe("getApprovalUrl – tenant-aware URL generation", () => {
  const originalBaseUrl = process.env.NEXT_PUBLIC_BASE_URL;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_BASE_URL = "https://example.com";
  });

  afterEach(() => {
    if (originalBaseUrl === undefined) {
      delete process.env.NEXT_PUBLIC_BASE_URL;
    } else {
      process.env.NEXT_PUBLIC_BASE_URL = originalBaseUrl;
    }
  });

  it("liaison URL includes tenant prefix when tenant is provided", () => {
    const url = getApprovalUrl("evt-123", ApproverType.LIAISON, "media-commons");
    expect(url).toBe(
      "https://example.com/media-commons/liaison?calendarEventId=evt-123",
    );
  });

  it("admin URL includes tenant prefix when tenant is provided", () => {
    const url = getApprovalUrl("evt-123", ApproverType.FINAL_APPROVER, "itp");
    expect(url).toBe(
      "https://example.com/itp/admin?calendarEventId=evt-123",
    );
  });

  it("falls back to DEFAULT_TENANT when tenant is undefined", () => {
    const url = getApprovalUrl("evt-123", ApproverType.LIAISON);
    expect(url).toBe(
      `https://example.com/${DEFAULT_TENANT}/liaison?calendarEventId=evt-123`,
    );
  });

  it("falls back to DEFAULT_TENANT for admin when tenant is undefined", () => {
    const url = getApprovalUrl("evt-123", ApproverType.FINAL_APPROVER);
    expect(url).toBe(
      `https://example.com/${DEFAULT_TENANT}/admin?calendarEventId=evt-123`,
    );
  });

  it("defaults to root path when approverType is not recognized", () => {
    const url = getApprovalUrl("evt-123", undefined, "media-commons");
    expect(url).toBe("https://example.com/?calendarEventId=evt-123");
  });
});
