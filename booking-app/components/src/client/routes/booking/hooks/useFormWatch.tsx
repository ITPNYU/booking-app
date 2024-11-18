import { useContext, useEffect, useRef } from "react";

import { BookingContext } from "../../../providers/BookingFormProvider";
import { Inputs } from "@/components/src/types";
import { InputsMediaCommons } from "@/components/src/typesMediaCommons";
import isEqual from "react-fast-compare";

export default function useFormWatch<T extends Inputs>(watchedFields: T) {
  const { setFormData } = useContext(BookingContext);

  const prevWatchedFieldsRef = useRef<T>();

  // update provider if form state changes so we can repopulate form if user switches form pages
  useEffect(() => {
    if (
      !prevWatchedFieldsRef.current ||
      !isEqual(prevWatchedFieldsRef.current, watchedFields)
    ) {
      // TODO fix type cast
      setFormData(watchedFields as unknown as InputsMediaCommons);
      prevWatchedFieldsRef.current = watchedFields;
    }
  }, [watchedFields]);
}
