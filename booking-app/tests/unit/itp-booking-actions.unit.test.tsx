import { describe, it, expect } from "vitest";
import { Actions } from "@/components/src/client/routes/admin/hooks/useBookingActions";
import { getTenantPolicy } from "@/components/src/tenantPolicy";

// Test tenant policy integration with booking actions
describe("ITP tenant policy for booking actions", () => {
  it("ITP has single approval level", () => {
    const policy = getTenantPolicy("itp");
    expect(policy.approvalLevels).toBe(1);
  });

  it("MC has two approval levels", () => {
    const policy = getTenantPolicy("mc");
    expect(policy.approvalLevels).toBe(2);
  });

  it("ITP does not have service requests", () => {
    const policy = getTenantPolicy("itp");
    expect(policy.hasServiceRequests).toBe(false);
  });

  it("ITP auto-closes on checkout", () => {
    const policy = getTenantPolicy("itp");
    expect(policy.autoCloseOnCheckout).toBe(true);
  });
});

describe("Actions enum", () => {
  it("has APPROVE action for single-step approval", () => {
    expect(Actions.APPROVE).toBe("Approve");
  });

  it("has FIRST_APPROVE for multi-step approval", () => {
    expect(Actions.FIRST_APPROVE).toBe("1st Approve");
  });

  it("APPROVE and FIRST_APPROVE are distinct", () => {
    expect(Actions.APPROVE).not.toBe(Actions.FIRST_APPROVE);
  });
});

describe("ITP booking machine auto-close", () => {
  it("Checked Out state has always transition to Closed", async () => {
    const { itpBookingMachine } = await import(
      "@/lib/stateMachines/itpBookingMachine"
    );
    const config = itpBookingMachine.config;
    const checkedOutState = (config.states as any)?.["Checked Out"];
    expect(checkedOutState).toBeDefined();
    expect(checkedOutState.always).toBeDefined();
    expect(checkedOutState.always.target).toBe("Closed");
  });

  it("Checked Out state does NOT have close event (replaced by always)", async () => {
    const { itpBookingMachine } = await import(
      "@/lib/stateMachines/itpBookingMachine"
    );
    const config = itpBookingMachine.config;
    const checkedOutState = (config.states as any)?.["Checked Out"];
    expect(checkedOutState.on).toBeUndefined();
  });
});
