import { createActor } from "xstate";
import { describe, expect, it } from "vitest";
import { approvalFlowSchema } from "@/components/src/client/routes/components/schemaTypes";
import { compileApprovalFlow } from "@/lib/stateMachines/approvalFlowMachine";
import { getMachineForTenant } from "@/lib/stateMachines/xstatePersistence";

const flow = approvalFlowSchema.parse({
  version: 1,
  initial: "Requested",
  states: {
    Requested: {
      on: { approve: { target: "Approved" } },
      always: [{ target: "Approved", guard: "shouldAutoApprove" }],
    },
    Approved: { type: "final" },
  },
});

describe("compileApprovalFlow", () => {
  it("sends approve to Approved and names shouldAutoApprove", () => {
    const machine = compileApprovalFlow(flow);
    const requested = machine.config.states?.Requested as {
      always?: { guard?: { type?: string } | string }[];
    };
    const guard = requested.always?.[0]?.guard;
    expect(guard).toEqual({ type: "shouldAutoApprove" });
    expect(typeof guard).not.toBe("function");

    const actor = createActor(machine, { input: { tenant: "other" } });
    actor.start();
    expect(actor.getSnapshot().value).toBe("Requested");
    actor.send({ type: "approve" });
    expect(actor.getSnapshot().value).toBe("Approved");
    actor.stop();
  });
});

describe("getMachineForTenant", () => {
  it("uses the compiled flow only when approvalFlow is present", () => {
    expect(getMachineForTenant("mc").id).toBe("MC Booking Request");
    expect(getMachineForTenant("itp").id).toBe("ITP Booking Request");
    expect(getMachineForTenant("mc", { approvalFlow: flow }).id).toBe(
      "Approval Flow",
    );
  });
});
