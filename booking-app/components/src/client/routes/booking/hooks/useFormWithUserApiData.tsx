import { Inputs, UserApiData } from "@/components/src/types";

import { UseFormReset } from "react-hook-form";
import { useEffect } from "react";

interface Props<T extends Inputs> {
  userApiData?: UserApiData;
  reset: UseFormReset<T>;
}

export default function useFormWithUserApiData<T extends Inputs>({
  userApiData,
  reset,
}: Props<T>) {
  useEffect(() => {
    if (userApiData && reset) {
      reset((formValues) => {
        let nNumber = "";
        if ("nNumber" in formValues) {
          nNumber = formValues.nNumber as string;
        }
        return {
          ...formValues,
          firstName: userApiData.preferred_first_name || formValues.firstName,
          lastName: userApiData.preferred_last_name || formValues.lastName,
          nNumber: userApiData.university_id || nNumber,
          netId: userApiData.netid || formValues.netId,
        };
      });
    }
  }, [userApiData, reset]);
}
