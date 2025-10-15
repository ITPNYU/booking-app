import { describe, expect, it, vi } from "vitest";

import { getBookingToolDeployUrl } from "@/components/src/server/ui";

describe("server/ui", () => {
  it("returns development url", () => {
    vi.stubEnv(
      "NEXT_PUBLIC_BRANCH_NAME",
      "development",
    );

    expect(getBookingToolDeployUrl()).toBe(
      "https://development-dot-flowing-mantis-389917.uc.r.appspot.com/",
    );
  });

  it("returns staging url", () => {
    vi.stubEnv("NEXT_PUBLIC_BRANCH_NAME", "staging");

    expect(getBookingToolDeployUrl()).toBe(
      "https://staging-dot-flowing-mantis-389917.uc.r.appspot.com/",
    );
  });

  it("returns production url by default", () => {
    vi.stubEnv("NEXT_PUBLIC_BRANCH_NAME", "production");

    expect(getBookingToolDeployUrl()).toBe(
      "https://flowing-mantis-389917.uc.r.appspot.com/",
    );
  });
});
