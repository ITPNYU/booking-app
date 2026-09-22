import { useContext, useEffect, useRef } from "react";
import { useForm, UseFormReturn } from "react-hook-form";
import isEqual from "react-fast-compare";

import { Inputs, UserApiData } from "../../../../types";
import { BookingContext } from "../bookingProvider";

interface Options {
  userApiData?: UserApiData;
  isVIP: boolean;
  isWalkIn: boolean;
}

/**
 * The react-hook-form instance behind one step of the request form. Every
 * step seeds its defaults from the answers already in BookingContext and
 * mirrors its own answers back as they change, so Details and Services share
 * one answer set while each page validates only the fields it renders.
 */
export default function useRequestFormState({
  userApiData,
  isVIP,
  isWalkIn,
}: Options): UseFormReturn<Inputs> {
  const { formData, setFormData, department, role, annexByRoom } =
    useContext(BookingContext);

  const getDefaultValue = (key: keyof UserApiData): string => {
    // For VIP and walk-in bookings, we don't need identity data.
    if (isVIP || isWalkIn || !userApiData) return "";
    return userApiData[key] || "";
  };

  const form = useForm<Inputs>({
    defaultValues: {
      setupDetails: "",
      cateringService: "",
      cleaningService: "",
      sponsorFirstName: "",
      sponsorLastName: "",
      sponsorEmail: "",
      mediaServicesDetails: "",
      equipmentServicesDetails: "",
      catering: "",
      chartFieldForCatering: "",
      chartFieldForCleaning: "",
      chartFieldForSecurity: "",
      chartFieldForRoomSetup: "",
      productionSchedule: "",
      roomSetupByRoom: {},
      setupDetailsByRoom: {},
      chartFieldForRoomSetupByRoom: {},
      furnishingsByRoom: {},
      chartFieldForFurnishingsByRoom: {},
      furnishingsDetails: "",
      furnishingsDetailsByRoom: {},
      equipmentServicesDetailsByRoom: {},
      cateringByRoom: {},
      chartFieldForCateringByRoom: {},
      cleaningByRoom: {},
      chartFieldForCleaningByRoom: {},
      hireSecurityByRoom: {},
      chartFieldForSecurityByRoom: {},
      hireSecurity: "",
      attendeeAffiliation: "",
      roomSetup: "",
      bookingType: "",
      secondaryFirstName: "",
      secondaryLastName: "",
      secondaryEmail: "",
      otherDepartment: "",
      firstName: getDefaultValue("preferred_first_name"),
      lastName: getDefaultValue("preferred_last_name"),
      nNumber: getDefaultValue("university_id"),
      netId: getDefaultValue("netid"),
      ...formData, // restore answers if navigating between form pages
      // copy department + role from earlier in form
      department,
      role,
      // Prefer live annex selections from room page over stale formData.
      annexByRoom: annexByRoom ?? formData?.annexByRoom ?? {},
    },
    mode: "onBlur",
    resolver: undefined,
  });

  const { setValue, watch } = form;

  // Keep form field in sync when user changes annex on the room selection page.
  useEffect(() => {
    setValue("annexByRoom", annexByRoom ?? {}, { shouldValidate: false });
  }, [annexByRoom, setValue]);

  const watchedFields = watch();
  const prevWatchedFieldsRef = useRef<Inputs>();

  // update provider if form state changes so we can repopulate form if user switches form pages
  useEffect(() => {
    if (
      !prevWatchedFieldsRef.current ||
      !isEqual(prevWatchedFieldsRef.current, watchedFields)
    ) {
      setFormData(watchedFields);
      prevWatchedFieldsRef.current = watchedFields;
    }
  }, [watchedFields, setFormData]);

  return form;
}
