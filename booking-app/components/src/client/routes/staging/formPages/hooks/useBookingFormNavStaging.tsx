import { usePathname, useRouter } from "next/navigation";

import { FormContextLevel } from "@/components/src/types";

export default function useBookingFormNavStaging(
  formContext: FormContextLevel
) {
  const pathname = usePathname();
  const router = useRouter();

  const goBack = (() => {
    const step = pathname.split("/")[3]; // Get the step
    const idSegment = pathname.split("/")[4] || ""; // Get the id if it exists

    switch (step) {
      case "form":
        return () =>
          router.push(`/staging${formContext}/start-date/${idSegment}`);
      default:
        return () => {};
    }
  })();

  const goNext = (() => {
    const step = pathname.split("/")[3]; // Get the step
    const idSegment = pathname.split("/")[4] || ""; // Get the id segment if it exists

    if (step === "start-date") {
      return () => router.push(`/staging${formContext}/form/${idSegment}`);
    }
    return () => {};
  })();

  const hideBackButton = pathname.includes("start-date");
  const hideNextButton = pathname.includes("/form");
  const showStatusBar = pathname.match(/\/(form|start-date)/);

  return { goNext, goBack, hideNextButton, hideBackButton, showStatusBar };
}
