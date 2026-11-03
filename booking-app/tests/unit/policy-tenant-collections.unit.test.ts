import { describe, expect, it } from "vitest";
import { TableNames, getTenantCollectionName } from "@/components/src/policy";

describe("getTenantCollectionName", () => {
  it("uses tenant-scoped settings collections", () => {
    expect(getTenantCollectionName(TableNames.SETTINGS, "mc")).toBe(
      "mc-settings",
    );
  });

  it("scopes bans to the tenant, like pre-ban logs", () => {
    expect(getTenantCollectionName(TableNames.BANNED, "mc")).toBe(
      "mc-usersBanned",
    );
    expect(getTenantCollectionName(TableNames.BANNED, "itp")).toBe(
      "itp-usersBanned",
    );
    expect(getTenantCollectionName(TableNames.PRE_BAN_LOGS, "mc")).toBe(
      "mc-preBanLogs",
    );
    expect(getTenantCollectionName(TableNames.BANNED)).toBe("usersBanned");
  });
});
