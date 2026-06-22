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

  it("normalizes service approver services and emails", () => {
    expect(
      getServiceApproverDocumentId(" equipment ", " Person@NYU.EDU "),
    ).toEqual(
      getServiceApproverDocumentId("equipment", "person@nyu.edu"),
    );
  });
});
