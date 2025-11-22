import { Box, Step, StepLabel, Stepper } from "@mui/material";
import React, { useEffect, useMemo, useState } from "react";

import { FormContextLevel } from "@/components/src/types";
import { usePathname } from "next/navigation";

interface Props {
  formContext: FormContextLevel;
}

const routeToStepNames = {
  netid: "NetID",
  role: "Affiliation",
  selectRoom: "Select Time",
  form: "Details",
  confirmation: "Confirmation",
};

export default function BookingFormStepper({ formContext }: Props) {
  const pathname = usePathname();
  const [activeStep, setActiveStep] = useState(0);

  const steps = useMemo(() => {
    if (formContext === FormContextLevel.MODIFICATION) {
      return [
        routeToStepNames.selectRoom,
        routeToStepNames.form,
        routeToStepNames.confirmation,
      ];
    } else if (formContext === FormContextLevel.WALK_IN) {
      return [
        routeToStepNames.netid,
        routeToStepNames.role,
        routeToStepNames.selectRoom,
        routeToStepNames.form,
        routeToStepNames.confirmation,
      ];
    } else {
      return [
        routeToStepNames.role,
        routeToStepNames.selectRoom,
        routeToStepNames.form,
        routeToStepNames.confirmation,
      ];
    }
  }, [formContext]);

  useEffect(() => {
    const step = pathname.split("/")[3]; // netid, role, selectRoom, form
    const stepName = routeToStepNames[step];
    if (stepName) {
      const index = steps.indexOf(stepName);
      setActiveStep(index >= 0 ? index : 0);
    } else {
      setActiveStep(0);
    }
  }, [pathname, steps]);

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
