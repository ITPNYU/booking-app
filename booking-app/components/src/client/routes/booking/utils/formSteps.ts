import { FormContextLevel } from "../../../../types";

/**
 * Route segments of the request form, in walk order. Every step has its own
 * page and Stepper label; a step with nothing to show is left out of the
 * list computed for a request (see useFormSteps).
 */
export type FormStep =
  "netid" | "role" | "selectRoom" | "form" | "services" | "confirmation";

export const FORM_STEP_LABELS: Record<FormStep, string> = {
  netid: "NetID",
  role: "Affiliation",
  selectRoom: "Select Time",
  form: "Details",
  services: "Services",
  confirmation: "Confirmation",
};

const ALL_STEPS: readonly FormStep[] = [
  "netid",
  "role",
  "selectRoom",
  "form",
  "services",
  "confirmation",
];

export function isFormStep(
  value: string | null | undefined,
): value is FormStep {
  return !!value && (ALL_STEPS as readonly string[]).includes(value);
}

/**
 * The steps a request walks in the given context. Services is included only
 * when at least one service section would show for the request.
 */
export function getFormSteps(
  formContext: FormContextLevel,
  { hasServicesStep }: { hasServicesStep: boolean },
): FormStep[] {
  const steps: FormStep[] = [];
  if (formContext === FormContextLevel.WALK_IN) steps.push("netid");
  if (formContext !== FormContextLevel.MODIFICATION) steps.push("role");
  steps.push("selectRoom", "form");
  if (hasServicesStep) steps.push("services");
  steps.push("confirmation");
  return steps;
}

export function getStepNeighbors(
  steps: FormStep[],
  current: FormStep | null,
): { previous: FormStep | null; next: FormStep | null } {
  const index = current ? steps.indexOf(current) : -1;
  if (index < 0) return { previous: null, next: null };
  return {
    previous: steps[index - 1] ?? null,
    next: steps[index + 1] ?? null,
  };
}

/** URL flow segment for a form context: "/book" → "book". */
export function formContextToFlowType(formContext: FormContextLevel): string {
  return formContext.replace(/^\//, "");
}

export function flowTypeToFormContext(flowType: string): FormContextLevel {
  const match = Object.values(FormContextLevel).find(
    (level) => formContextToFlowType(level) === flowType,
  );
  return match ?? FormContextLevel.FULL_FORM;
}
