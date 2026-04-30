import { describe, expect, it } from "vitest";
import { TableNames, getTenantCollectionName } from "@/components/src/policy";

describe("getTenantCollectionName", () => {
  it("uses tenant-scoped settings collections", () => {
    expect(getTenantCollectionName(TableNames.SETTINGS, "mc")).toBe(
      "mc-settings",
    );
  });
});
