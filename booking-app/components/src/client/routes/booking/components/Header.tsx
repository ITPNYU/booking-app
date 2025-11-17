import { Box, useScrollTrigger } from "@mui/material";
import React, { useMemo } from "react";
import { usePathname, useRouter, useParams } from "next/navigation";

import BookingFormStepper from "./Stepper";
import BookingStatusBar from "./BookingStatusBar";
import { FormContextLevel } from "@/components/src/types";
import { styled } from "@mui/system";

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

export const Header = ({ formContext }: Props) => {
  const router = useRouter();
  const { tenant } = useParams();
  const pathname = usePathname();

  const trigger = useScrollTrigger({
    disableHysteresis: true,
    threshold: 100,
  });

  // /book, /walk-in, /edit/<id>, /modification/<id>
  if (/^\/(book|walk-in|(?:edit|modification)\/[^\/]+)$/.test(pathname)) {
    return null;
  }

  const goBack = (() => {
    const step = pathname.split("/")[3]; // Get the step
    const idSegment = pathname.split("/")[4] || ""; // Get the id if it exists

    switch (step) {
      case "selectRoom":
        if (formContext === FormContextLevel.MODIFICATION) return () => {};
        if (formContext === FormContextLevel.WALK_IN) {
          return () => router.push(`/${tenant}/${formContext}/role/${idSegment}`);
        }
        return () => router.push(`/${tenant}/${formContext}/role/${idSegment}`);
      case "form":
        return () => router.push(`/${tenant}/${formContext}/selectRoom/${idSegment}`);
      case "role":
        if (formContext === FormContextLevel.WALK_IN) {
          return () => router.push(`/${tenant}/${formContext}/netid`);
        }
        return () => {};
      default:
        return () => {};
    }
  })();

  const goNext = (() => {
    const step = pathname.split("/")[3]; // Get the step
    const idSegment = pathname.split("/")[4] || ""; // Get the id segment if it exists

    if (step === "selectRoom") {
      return () => router.push(`/${tenant}/${formContext}/form/${idSegment}`);
    }
    return () => {};
  })();

  const hideBackButton =
    formContext === FormContextLevel.MODIFICATION &&
    pathname.includes("/selectRoom");
  const hideNextButton = pathname.includes("/form");
  const showStatusBar = pathname.match(/\/(selectRoom|form)/);

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
