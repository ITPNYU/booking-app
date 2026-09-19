import { Box, useScrollTrigger } from "@mui/material";
import dynamic from "next/dynamic";
import React from "react";
import { usePathname, useRouter, useParams } from "next/navigation";

import { FormContextLevel } from "@/components/src/types";
import { styled } from "@mui/system";
import useFormSteps from "../hooks/useFormSteps";
import { buildBookingUrl } from "../utils/bookingUrlParser";
import { FormStep, formContextToFlowType } from "../utils/formSteps";
import BookingFormStepper from "./Stepper";

const BookingStatusBar = dynamic(() => import("./BookingStatusBar"), {
  ssr: false,
  loading: () => null,
});

const StickyScroll = styled(Box)`
  position: -webkit-sticky;
  position: sticky;
  top: 0;
  z-index: 1000;
  background-color: white;
  padding-bottom: 20px;
  transition: box-shadow 300ms cubic-bezier(0.4, 0, 0.2, 1) 0ms;
`;

interface Props {
  formContext: FormContextLevel;
}

/** Steps whose page owns its own Next / Submit button. */
const STEPS_WITH_OWN_NEXT: FormStep[] = ["form", "services"];
const STEPS_WITH_STATUS_BAR: FormStep[] = ["selectRoom", "form", "services"];

export const Header = ({ formContext }: Props) => {
  const router = useRouter();
  const { tenant } = useParams();
  const pathname = usePathname();
  const { currentStep, previousStep, nextStep } = useFormSteps(formContext);

  const trigger = useScrollTrigger({
    disableHysteresis: true,
    threshold: 100,
  });

  // /book, /walk-in, /edit/<id>, /modification/<id>
  if (/^\/(book|walk-in|(?:edit|modification)\/[^\/]+)$/.test(pathname)) {
    return null;
  }

  const idSegment = pathname.split("/")[4] || ""; // Get the id if it exists
  const flowType = formContextToFlowType(formContext);
  const goToStep = (step: FormStep | null) =>
    step
      ? () =>
          router.push(
            buildBookingUrl(String(tenant), flowType, step, idSegment),
          )
      : () => {};

  const goBack = goToStep(previousStep);
  // Only Select Time moves on from the status bar; the other steps own Next.
  const goNext = currentStep === "selectRoom" ? goToStep(nextStep) : () => {};

  const hideBackButton = !previousStep;
  const hideNextButton =
    !currentStep || STEPS_WITH_OWN_NEXT.includes(currentStep);
  const showStatusBar =
    !!currentStep && STEPS_WITH_STATUS_BAR.includes(currentStep);

  return (
    <StickyScroll
      boxShadow={
        trigger
          ? "0px 2px 4px -1px rgba(0, 0, 0, 0.2), 0px 4px 5px 0px rgba(0, 0, 0, 0), 0px 1px 10px 0px rgba(0, 0, 0, 0.12)"
          : ""
      }
    >
      <div>
        <BookingFormStepper formContext={formContext} />
        {showStatusBar && (
          <BookingStatusBar
            {...{ goBack, goNext, hideNextButton, hideBackButton, formContext }}
          />
        )}
      </div>
    </StickyScroll>
  );
};
