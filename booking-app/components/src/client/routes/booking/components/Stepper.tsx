import { Box, Step, StepLabel, Stepper } from "@mui/material";
import React, { useEffect, useState } from "react";

import { FormContextLevel } from "@/components/src/types";
import { usePathname } from "next/navigation";

const steps = ["Affiliation", "Select Time", "Details", "Confirmation"];

interface Props {
  formContext: FormContextLevel;
}

export default function BookingFormStepper({ formContext }: Props) {
  const pathname = usePathname();
  const [activeStep, setActiveStep] = useState(0);

  useEffect(() => {
    const step = pathname.split("/")[2]; // role, selectRoom, form
    switch (step) {
      case "role":
        setActiveStep(0);
        break;
      case "selectRoom":
        setActiveStep(1);
        break;
      case "form":
        setActiveStep(2);
        break;
      case "confirmation":
        setActiveStep(3);
        break;
      default:
        setActiveStep(0);
    }
  }, [pathname, formContext]);

  return (
    <Box sx={{ width: "100%", padding: 4 }}>
      <Stepper activeStep={activeStep}>
        {steps.map((label) => {
          const stepProps: { completed?: boolean } = {};
          const labelProps: {
            optional?: React.ReactNode;
          } = {};
          return (
            <Step key={label} {...stepProps}>
              <StepLabel {...labelProps}>{label}</StepLabel>
            </Step>
          );
        })}
      </Stepper>
    </Box>
  );
}
