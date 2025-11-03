import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/firebase/server/adminDb", () => ({
  serverGetDocumentById: vi.fn(),
}));

import { getEmailBranchTag } from "@/components/src/server/emails";

describe("server/emails", () => {
  it("returns dev prefix when branch is development", () => {
    vi.stubEnv("NEXT_PUBLIC_BRANCH_NAME", "development");

    expect(getEmailBranchTag()).toBe("[DEV] ");
  });

  it("returns staging prefix when branch is staging", () => {
    vi.stubEnv("NEXT_PUBLIC_BRANCH_NAME", "staging");

    expect(getEmailBranchTag()).toBe("[STAGING] ");
  });

  it("returns empty string for other branches", () => {
    vi.stubEnv("NEXT_PUBLIC_BRANCH_NAME", "production");

    expect(getEmailBranchTag()).toBe("");
  });
});
