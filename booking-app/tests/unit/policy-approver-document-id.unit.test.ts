import {
  getResourceApproverDocumentId,
  getServiceApproverDocumentId,
} from "@/components/src/policy";
import { describe, expect, it } from "vitest";

describe("approver document IDs", () => {
  it("normalizes resource approver resource IDs and emails", () => {
    expect(
      getResourceApproverDocumentId(" room/a ", " Person@NYU.EDU "),
    ).toEqual(getResourceApproverDocumentId("room/a", "person@nyu.edu"));
  });

  it("normalizes service approver resources, services, and emails", () => {
    expect(
      getServiceApproverDocumentId(
        " room/a ",
        " equipment ",
        " Person@NYU.EDU ",
      ),
    ).toEqual(
      getServiceApproverDocumentId("room/a", "equipment", "person@nyu.edu"),
    );
  });

  it("does not collide when service approver parts contain delimiter characters", () => {
    expect(
      getServiceApproverDocumentId("a-", "b", "e@nyu.edu"),
    ).not.toEqual(getServiceApproverDocumentId("a", "-b", "e@nyu.edu"));
  });
});
