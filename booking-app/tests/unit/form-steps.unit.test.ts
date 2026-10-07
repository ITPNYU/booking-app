import { describe, expect, it } from "vitest";
import { FormContextLevel } from "@/components/src/types";
import {
  FORM_STEP_LABELS,
  flowTypeToFormContext,
  formContextToFlowType,
  getFormSteps,
  getStepNeighbors,
  isFormStep,
} from "@/components/src/client/routes/booking/utils/formSteps";

describe("getFormSteps", () => {
  it("orders book, VIP and edit as Affiliation → Select Time → Details → Services → Confirmation", () => {
    for (const formContext of [
      FormContextLevel.FULL_FORM,
      FormContextLevel.VIP,
      FormContextLevel.EDIT,
    ]) {
      expect(getFormSteps(formContext, { hasServicesStep: true })).toEqual([
        "role",
        "selectRoom",
        "form",
        "services",
        "confirmation",
      ]);
    }
  });

  it("prefixes walk-in with the NetID step", () => {
    expect(
      getFormSteps(FormContextLevel.WALK_IN, { hasServicesStep: true }),
    ).toEqual([
      "netid",
      "role",
      "selectRoom",
      "form",
      "services",
      "confirmation",
    ]);
  });

  it("drops the Affiliation step for modification", () => {
    expect(
      getFormSteps(FormContextLevel.MODIFICATION, { hasServicesStep: true }),
    ).toEqual(["selectRoom", "form", "services", "confirmation"]);
  });

  it("skips Services when no service section would show", () => {
    expect(
      getFormSteps(FormContextLevel.FULL_FORM, { hasServicesStep: false }),
    ).toEqual(["role", "selectRoom", "form", "confirmation"]);
    expect(
      getFormSteps(FormContextLevel.WALK_IN, { hasServicesStep: false }),
    ).toEqual(["netid", "role", "selectRoom", "form", "confirmation"]);
    expect(
      getFormSteps(FormContextLevel.MODIFICATION, { hasServicesStep: false }),
    ).toEqual(["selectRoom", "form", "confirmation"]);
  });
});

describe("FORM_STEP_LABELS", () => {
  it("labels every step for the Stepper", () => {
    expect(FORM_STEP_LABELS).toEqual({
      netid: "NetID",
      role: "Affiliation",
      selectRoom: "Select Time",
      form: "Details",
      services: "Services",
      confirmation: "Confirmation",
    });
  });
});

describe("getStepNeighbors", () => {
  const steps = getFormSteps(FormContextLevel.FULL_FORM, {
    hasServicesStep: true,
  });

  it("returns the previous and next step around the current one", () => {
    expect(getStepNeighbors(steps, "form")).toEqual({
      previous: "selectRoom",
      next: "services",
    });
    expect(getStepNeighbors(steps, "services")).toEqual({
      previous: "form",
      next: "confirmation",
    });
  });

  it("has no previous step at the start and no next step at the end", () => {
    expect(getStepNeighbors(steps, "role")).toEqual({
      previous: null,
      next: "selectRoom",
    });
    expect(getStepNeighbors(steps, "confirmation")).toEqual({
      previous: "services",
      next: null,
    });
  });

  it("returns nothing for a step outside the list", () => {
    expect(getStepNeighbors(steps, "netid")).toEqual({
      previous: null,
      next: null,
    });
    expect(getStepNeighbors(steps, null)).toEqual({
      previous: null,
      next: null,
    });
  });

  it("skips over Services when it is not in the list", () => {
    const withoutServices = getFormSteps(FormContextLevel.FULL_FORM, {
      hasServicesStep: false,
    });
    expect(getStepNeighbors(withoutServices, "form")).toEqual({
      previous: "selectRoom",
      next: "confirmation",
    });
  });
});

describe("isFormStep", () => {
  it("recognises route segments that are steps", () => {
    expect(isFormStep("services")).toBe(true);
    expect(isFormStep("form")).toBe(true);
    expect(isFormStep("landing")).toBe(false);
    expect(isFormStep(null)).toBe(false);
    expect(isFormStep(undefined)).toBe(false);
  });
});

describe("flow type conversion", () => {
  it("strips the leading slash from a form context", () => {
    expect(formContextToFlowType(FormContextLevel.FULL_FORM)).toBe("book");
    expect(formContextToFlowType(FormContextLevel.WALK_IN)).toBe("walk-in");
    expect(formContextToFlowType(FormContextLevel.EDIT)).toBe("edit");
  });

  it("maps a URL flow type back to its form context", () => {
    expect(flowTypeToFormContext("book")).toBe(FormContextLevel.FULL_FORM);
    expect(flowTypeToFormContext("vip")).toBe(FormContextLevel.VIP);
    expect(flowTypeToFormContext("walk-in")).toBe(FormContextLevel.WALK_IN);
    expect(flowTypeToFormContext("modification")).toBe(
      FormContextLevel.MODIFICATION,
    );
    expect(flowTypeToFormContext("edit")).toBe(FormContextLevel.EDIT);
  });

  it("falls back to the full form for an unknown flow type", () => {
    expect(flowTypeToFormContext("unknown")).toBe(FormContextLevel.FULL_FORM);
  });
});
