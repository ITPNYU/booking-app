import { Box, Step, StepLabel, Stepper } from "@mui/material";
import React from "react";

import { FormContextLevel } from "@/components/src/types";
import useFormSteps from "../hooks/useFormSteps";
import { FORM_STEP_LABELS } from "../utils/formSteps";

interface Props {
  formContext: FormContextLevel;
}

export default function BookingFormStepper({ formContext }: Props) {
  const { steps, currentStep } = useFormSteps(formContext);
  const activeStep = Math.max(0, currentStep ? steps.indexOf(currentStep) : 0);

  return (
    <Box sx={{ width: "100%", padding: 4 }}>
      <Stepper activeStep={activeStep}>
        {steps.map((step) => (
          <Step key={step}>
            <StepLabel>{FORM_STEP_LABELS[step]}</StepLabel>
          </Step>
        ))}
      </Stepper>
    </Box>
  );
}
