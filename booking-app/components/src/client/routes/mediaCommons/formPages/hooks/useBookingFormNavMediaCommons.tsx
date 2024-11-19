import { usePathname, useRouter } from "next/navigation";

import { FormContextLevel } from "@/components/src/types";

export default function useBookingFormNavMediaCommons(
  formContext: FormContextLevel
) {
  const pathname = usePathname();
  const router = useRouter();

  const goBack = (() => {
    const step = pathname.split("/")[3]; // Get the step
    const idSegment = pathname.split("/")[4] || ""; // Get the id if it exists

    switch (step) {
      case "selectRoom":
        if (formContext === FormContextLevel.MODIFICATION) return () => {};
        return () =>
          router.push(`/media-commons${formContext}/role/${idSegment}`);
      case "form":
        return () =>
          router.push(`/media-commons${formContext}/selectRoom/${idSegment}`);
      default:
        return () => {};
    }
  })();

  const goNext = (() => {
    const step = pathname.split("/")[3]; // Get the step
    const idSegment = pathname.split("/")[4] || ""; // Get the id segment if it exists

    if (step === "selectRoom") {
      return () =>
        router.push(`/media-commons${formContext}/form/${idSegment}`);
    }
    return () => {};
  })();

  const hideBackButton =
    formContext === FormContextLevel.MODIFICATION &&
    pathname.includes("/selectRoom");
  const hideNextButton = pathname.includes("/form");
  const showStatusBar = pathname.match(/\/(selectRoom|form)/);

  return { goNext, goBack, hideNextButton, hideBackButton, showStatusBar };
}
