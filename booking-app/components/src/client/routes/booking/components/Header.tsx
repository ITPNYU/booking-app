import { Box, useScrollTrigger } from "@mui/material";
import React, { useMemo } from "react";
import { usePathname, useRouter } from "next/navigation";

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
  const pathname = usePathname();

  const trigger = useScrollTrigger({
    disableHysteresis: true,
    threshold: 100,
  });

  // don't show on form landing pages
  // /book, /walk-in, /edit/<id>
  if (/^\/(book|walk-in|edit\/[^\/]+)$/.test(pathname)) {
    return null;
  }

  const goBack = (() => {
    const step = pathname.split("/")[2]; // Get the step
    const idSegment = pathname.split("/")[3] || ""; // Get the id if it exists

    switch (step) {
      case "selectRoom":
        return () => router.push(`${formContext}/role/${idSegment}`);
      case "form":
        return () => router.push(`${formContext}/selectRoom/${idSegment}`);
      default:
        return () => {};
    }
  })();

  const goNext = (() => {
    const step = pathname.split("/")[2]; // Get the step
    const idSegment = pathname.split("/")[3] || ""; // Get the id segment if it exists

    if (step === "selectRoom") {
      return () => router.push(`${formContext}/form/${idSegment}`);
    }
    return () => {};
  })();

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
          <BookingStatusBar {...{ goBack, goNext, hideNextButton }} />
        )}
      </div>
    </StickyScroll>
  );
};
