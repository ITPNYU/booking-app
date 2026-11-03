import { describe, expect, it } from "vitest";

import {
  applyApproverChange,
  getApproverResources,
  getApproversResourceDocumentId,
  getResourceApproverServices,
  getServiceApproverResourceIds,
  hasLegacyServiceApproverFlag,
  parseBookingResourceIds,
  toApproverService,
  toApproversResource,
  unionResourceApprovers,
} from "@/components/src/utils/approversResources";

const resources = [
  { resourceId: "202", services: { equipment: {}, catering: {} } },
  { resourceId: "1201", services: { setup: {}, staffing: {} } },
  // Annex space booked under 1201; offers its own catering.
  { resourceId: "1201A", parentResourceId: "1201", services: { catering: {} } },
  { resourceId: "103", services: ["equipment", "cleanup"] },
];

describe("toApproversResource", () => {
  it("normalizes emails, drops unknown services, and derives serviceApproverEmails", () => {
    expect(
      toApproversResource(" 202 ", {
        resourceApprovers: [" A@NYU.EDU ", "a@nyu.edu", 3],
        serviceApprovers: {
          equipment: ["C@nyu.edu"],
          staff: ["d@nyu.edu", "c@nyu.edu"],
          parking: ["x@nyu.edu"],
          catering: [],
        },
      }),
    ).toEqual({
      resourceId: "202",
      resourceApprovers: ["a@nyu.edu"],
      serviceApprovers: {
        equipment: ["c@nyu.edu"],
        staff: ["d@nyu.edu", "c@nyu.edu"],
      },
      serviceApproverEmails: ["c@nyu.edu", "d@nyu.edu"],
    });
  });

  it("reads a missing doc as a resource with no approvers", () => {
    expect(toApproversResource("202", undefined)).toEqual({
      resourceId: "202",
      resourceApprovers: [],
      serviceApprovers: {},
      serviceApproverEmails: [],
    });
  });
});

describe("applyApproverChange", () => {
  const empty = toApproversResource("202", undefined);

  it("adds and removes resource approvers without duplicates", () => {
    const added = applyApproverChange(
      applyApproverChange(empty, {
        action: "add",
        kind: "resource",
        email: "A@nyu.edu",
      }),
      { action: "add", kind: "resource", email: "a@nyu.edu " },
    );
    expect(added.resourceApprovers).toEqual(["a@nyu.edu"]);
    expect(
      applyApproverChange(added, {
        action: "remove",
        kind: "resource",
        email: "A@NYU.edu",
      }).resourceApprovers,
    ).toEqual([]);
  });

  it("keeps serviceApproverEmails in step with service changes", () => {
    const withTwo = [
      { service: "equipment", email: "c@nyu.edu" },
      { service: "catering", email: "c@nyu.edu" },
      { service: "catering", email: "e@nyu.edu" },
    ].reduce(
      (doc, { service, email }) =>
        applyApproverChange(doc, {
          action: "add",
          kind: "service",
          service: service as "equipment" | "catering",
          email,
        }),
      empty,
    );
    expect(withTwo.serviceApproverEmails.sort()).toEqual([
      "c@nyu.edu",
      "e@nyu.edu",
    ]);

    const removed = applyApproverChange(withTwo, {
      action: "remove",
      kind: "service",
      service: "catering",
      email: "e@nyu.edu",
    });
    expect(removed.serviceApprovers.catering).toEqual(["c@nyu.edu"]);
    expect(removed.serviceApproverEmails).toEqual(["c@nyu.edu"]);
  });
});

describe("resource helpers", () => {
  it("uses the resource ID as the doc ID", () => {
    expect(getApproversResourceDocumentId(" 202 ")).toBe("202");
    expect(getApproversResourceDocumentId("studio/a")).toBe("studio%2Fa");
  });

  it("parses booking room IDs, including numeric and comma-joined ones", () => {
    expect(parseBookingResourceIds(202)).toEqual(["202"]);
    expect(parseBookingResourceIds(" 202, 1201 ,202,")).toEqual([
      "202",
      "1201",
    ]);
    expect(parseBookingResourceIds(undefined)).toEqual([]);
  });

  it("maps stored service names onto approver services", () => {
    expect(toApproverService("Staffing")).toBe("staff");
    expect(toApproverService("cleanup")).toBe("cleaning");
    expect(toApproverService("annex")).toBeNull();
  });

  it("lists rooms only, in resource order", () => {
    expect(
      getApproverResources(resources).map(({ resourceId }) => resourceId),
    ).toEqual(["103", "202", "1201"]);
  });

  it("includes an annex space's services in its parent room's", () => {
    expect(getResourceApproverServices(resources[1], resources)).toEqual([
      "setup",
      "staff",
      "catering",
    ]);
    expect(getResourceApproverServices(resources[3], resources)).toEqual([
      "equipment",
      "cleaning",
    ]);
  });
});

describe("getServiceApproverResourceIds", () => {
  it("keeps only the booked rooms that offer the service", () => {
    expect(
      getServiceApproverResourceIds("202,1201", "setup", resources),
    ).toEqual(["1201"]);
    expect(
      getServiceApproverResourceIds("202,1201", "catering", resources),
    ).toEqual(["202", "1201"]);
  });

  it("keeps rooms missing from the schema", () => {
    expect(
      getServiceApproverResourceIds("202,999", "setup", resources),
    ).toEqual(["999"]);
  });

  it("falls back to every booked room when none offers the service", () => {
    expect(
      getServiceApproverResourceIds("202,1201", "security", resources),
    ).toEqual(["202", "1201"]);
  });
});

describe("unionResourceApprovers", () => {
  const byRoom: Record<string, string[]> = {
    "202": ["a@nyu.edu"],
    "1201": ["b@nyu.edu", "a@nyu.edu"],
  };

  it("lets an approver of any booked room act, not only one assigned to all of them", () => {
    expect(
      unionResourceApprovers(["202", "1201"], (id) => byRoom[id] ?? []),
    ).toEqual({ approvers: ["a@nyu.edu", "b@nyu.edu"], uncovered: [] });
  });

  it("reports the rooms with no approvers of their own", () => {
    expect(
      unionResourceApprovers(["202", "103"], (id) => byRoom[id] ?? []),
    ).toEqual({ approvers: ["a@nyu.edu"], uncovered: ["103"] });
  });
});

describe("hasLegacyServiceApproverFlag", () => {
  it("is true for any service flag and false for other rights", () => {
    expect(hasLegacyServiceApproverFlag({ isFurnishings: true })).toBe(true);
    expect(hasLegacyServiceApproverFlag({ isSecurity: true })).toBe(true);
    expect(hasLegacyServiceApproverFlag({ isAdmin: true })).toBe(false);
    expect(hasLegacyServiceApproverFlag(undefined)).toBe(false);
  });
});
