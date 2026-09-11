import { describe, expect, it } from "vitest";
import { createActor } from "xstate";

import { mcBookingMachine } from "@/lib/stateMachines/mcBookingMachine";
import {
  MC_SERVICE_CONFIGS,
  expectedServiceCloseoutRegion,
  expectedServiceRequestRegion,
} from "./helpers/mcServiceStateFactory";

/**
 * The MC machine spells out one literal region per service so Stately Studio
 * can import/export the file. These tests pin every region to the reference
 * shape in helpers/mcServiceStateFactory.ts so a hand edit (or a Stately
 * export) cannot leave one service structurally different from the others.
 */
describe("mcBookingMachine service regions stay in parity", () => {
  const config = mcBookingMachine.config as any;
  const requestRegions = config.states["Services Request"].states;
  const closeoutRegions = config.states["Service Closeout"].states;

  it("declares exactly one request region and one closeout region per service", () => {
    expect(Object.keys(requestRegions).sort()).toEqual(
      MC_SERVICE_CONFIGS.map((c) => `${c.name} Request`).sort(),
    );
    expect(Object.keys(closeoutRegions).sort()).toEqual(
      MC_SERVICE_CONFIGS.map((c) => `${c.name} Closeout`).sort(),
    );
  });

  it.each(MC_SERVICE_CONFIGS)(
    "$name Request matches the reference shape",
    (service) => {
      expect(requestRegions[`${service.name} Request`]).toEqual(
        expectedServiceRequestRegion(service),
      );
    },
  );

  it.each(MC_SERVICE_CONFIGS)(
    "$name Closeout matches the reference shape",
    (service) => {
      expect(closeoutRegions[`${service.name} Closeout`]).toEqual(
        expectedServiceCloseoutRegion(service),
      );
    },
  );

  it("implements every guard and action a service region references", () => {
    const impl = (mcBookingMachine as any).implementations;
    for (const service of MC_SERVICE_CONFIGS) {
      expect(impl.guards, service.requestGuard).toHaveProperty(
        service.requestGuard,
      );
      expect(impl.guards, service.approvedGuard).toHaveProperty(
        service.approvedGuard,
      );
      expect(impl.actions, service.approveAction).toHaveProperty(
        service.approveAction,
      );
      expect(impl.actions, service.declineAction).toHaveProperty(
        service.declineAction,
      );
    }
  });

  it.each(MC_SERVICE_CONFIGS)(
    "$name approve/decline events write servicesApproved.$contextKey",
    (service) => {
      const startInRequested = () =>
        createActor(mcBookingMachine, {
          snapshot: mcBookingMachine.resolveState({
            value: {
              "Services Request": {
                [`${service.name} Request`]: `${service.name} Requested`,
              },
            },
            context: {
              tenant: "mc",
              servicesRequested: { [service.contextKey]: true },
              servicesApproved: {},
            },
          }),
        }).start();

      const approving = startInRequested();
      approving.send({ type: service.approveEvent } as any);
      expect(approving.getSnapshot().context.servicesApproved).toEqual({
        [service.contextKey]: true,
      });
      expect(approving.getSnapshot().value).toBe("Approved");

      const declining = startInRequested();
      declining.send({ type: service.declineEvent } as any);
      expect(declining.getSnapshot().context.servicesApproved).toEqual({
        [service.contextKey]: false,
      });
      expect(declining.getSnapshot().value).toBe("Declined");
    },
  );
});
