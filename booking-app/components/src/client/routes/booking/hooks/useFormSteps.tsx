import { useContext, useMemo } from "react";
import { usePathname } from "next/navigation";

import { FormContextLevel } from "../../../../types";
import { getServiceRooms } from "../../../../utils/resourceServicesUtils";
import {
  getRequestOrigin,
  getServiceSectionFlags,
  hasAnyServiceSection,
} from "../../../../utils/serviceSections";
import { useTenantSchema } from "../../components/SchemaProvider";
import { BookingContext } from "../bookingProvider";
import { parseBookingUrl } from "../utils/bookingUrlParser";
import {
  FormStep,
  getFormSteps,
  getStepNeighbors,
  isFormStep,
} from "../utils/formSteps";

export interface FormStepsState {
  /** The steps this request walks, in order. */
  steps: FormStep[];
  /** Whether the Services step has a section to show for the selected rooms. */
  hasServicesStep: boolean;
  /** The step of the current route, or null outside the request form. */
  currentStep: FormStep | null;
  previousStep: FormStep | null;
  nextStep: FormStep | null;
}

/**
 * Whether the Services step has a section to show for the selected rooms
 * (with their annex spaces) under the request origin. Before any room is
 * selected the step is assumed present; it drops out once the selection
 * shows that no service section would render.
 */
export function useHasServicesStep(formContext: FormContextLevel): boolean {
  const { selectedRooms, annexByRoom, formData } = useContext(BookingContext);
  const schema = useTenantSchema();
  const tenantShowSetup = schema.form?.services?.showSetup ?? false;
  const schemaResources = schema.resources;

  return useMemo(() => {
    const rooms = selectedRooms ?? [];
    if (rooms.length === 0) return true;
    const serviceRooms = getServiceRooms(
      rooms,
      annexByRoom ?? {},
      schemaResources ?? [],
    );
    const origin = getRequestOrigin(formContext, formData?.origin);
    return hasAnyServiceSection(
      getServiceSectionFlags(serviceRooms, origin, tenantShowSetup),
    );
  }, [
    selectedRooms,
    annexByRoom,
    schemaResources,
    formContext,
    formData?.origin,
    tenantShowSetup,
  ]);
}

/**
 * The shared step list for a request: computed from the form context, the
 * selected rooms and the request origin. Consumed by the Stepper, the Header
 * buttons and the missing-data guard so they never disagree on which steps
 * exist.
 */
export default function useFormSteps(
  formContext: FormContextLevel,
): FormStepsState {
  const pathname = usePathname();
  const hasServicesStep = useHasServicesStep(formContext);

  return useMemo(() => {
    const steps = getFormSteps(formContext, { hasServicesStep });
    const parsedStep = parseBookingUrl(pathname ?? "").step;
    const currentStep = isFormStep(parsedStep) ? parsedStep : null;
    const { previous, next } = getStepNeighbors(steps, currentStep);
    return {
      steps,
      hasServicesStep,
      currentStep,
      previousStep: previous,
      nextStep: next,
    };
  }, [formContext, hasServicesStep, pathname]);
}
