import { Box, Button, Typography } from "@mui/material";
import {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { SubmitHandler, useForm } from "react-hook-form";
import {
  AttendeeAffiliation,
  FormContextLevel,
  Inputs,
  Role,
  UserApiData,
} from "../../../../types";
import {
  BookingFormAgreementCheckbox,
  BookingFormDropdown,
  BookingFormSwitch,
  BookingFormTextField,
} from "./BookingFormInputs";

import { styled } from "@mui/system";
import { useParams, useRouter } from "next/navigation";
import isEqual from "react-fast-compare";
import { DatabaseContext } from "../../components/Provider";
import { useTenantSchema } from "../../components/SchemaProvider";
import { BookingContext } from "../bookingProvider";
import { mapAffiliationToRole } from "../formPages/UserRolePage";
import useCheckAutoApproval from "../hooks/useCheckAutoApproval";
import useSubmitBooking from "../hooks/useSubmitBooking";
import BookingFormEquipmentServices from "./BookingFormEquipmentServices";
import BookingFormStaffingServices from "./BookingFormStaffingServices";
import BookingSelection from "./BookingSelection";

const Section = ({ title, children }) => (
  <div style={{ marginBottom: "20px" }}>
    <Typography variant="h5" style={{ marginBottom: "8px" }}>
      {title}
    </Typography>
    <div>{children}</div>
  </div>
);

const Center = styled(Box)`
  width: 100%;
  height: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
`;

const Container = styled(Box)(({ theme }) => ({
  width: "100%",
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-start",
  borderRadius: "4px",
  border: `1px solid ${theme.palette.custom.border}` || "#e3e3e3",
}));

interface Props {
  calendarEventId?: string;
  formContext: FormContextLevel;
  userApiData?: UserApiData;
}

export default function FormInput({
  calendarEventId,
  formContext,
  userApiData,
}: Props) {
  const { userEmail, settings } = useContext(DatabaseContext);
  const {
    role,
    department,
    selectedRooms,
    bookingCalendarInfo,
    isBanned,
    needsSafetyTraining,
    isInBlackoutPeriod,
    formData,
    setFormData,
  } = useContext(BookingContext);
  const router = useRouter();
  const { tenant } = useParams();
  const registerEvent = useSubmitBooking(formContext);
  const { isAutoApproval } = useCheckAutoApproval();

  const isWalkIn = formContext === FormContextLevel.WALK_IN;
  const isMod = formContext === FormContextLevel.MODIFICATION;
  const isFullForm = formContext === FormContextLevel.FULL_FORM;
  const isVIP = formContext === FormContextLevel.VIP;
  const isBooking = !isWalkIn && !isVIP;

  const getDefaultValue = (key: keyof UserApiData): string => {
    // For VIP and walk-in bookings, we don't need identity data.
    if (isVIP || isWalkIn || !userApiData) return "";
    return userApiData[key] || "";
  };

  const {
    showNNumber,
    showSponsor,
    showSetup,
    showBookingTypes,
    agreements,
    roleMapping,
  } = useTenantSchema();

  // Determine which services to show based on selected rooms and schema resources
  const showEquipment = useMemo(() => {
    return selectedRooms.some((room) => room.services?.includes("equipment"));
  }, [selectedRooms]);

  const showStaffing = useMemo(() => {
    return selectedRooms.some((room) => room.services?.includes("staffing"));
  }, [selectedRooms]);

  const showCatering = useMemo(() => {
    return selectedRooms.some((room) => room.services?.includes("catering"));
  }, [selectedRooms]);

  const showHireSecurity = useMemo(() => {
    return selectedRooms.some((room) => room.services?.includes("security"));
  }, [selectedRooms]);

  const showCleaning = useMemo(() => {
    return selectedRooms.some((room) => room.services?.includes("cleaning"));
  }, [selectedRooms]);

  const {
    control,
    handleSubmit,
    trigger,
    watch,
    reset,
    formState: { errors, isValid },
  } = useForm<Inputs>({
    defaultValues: {
      setupDetails: "",
      cateringService: "",
      cleaningService: "",
      sponsorFirstName: "",
      sponsorLastName: "",
      sponsorEmail: "",
      mediaServicesDetails: "",
      equipmentServicesDetails: "",
      staffingServicesDetails: "",
      catering: "",
      chartFieldForCatering: "",
      chartFieldForCleaning: "",
      chartFieldForSecurity: "",
      chartFieldForRoomSetup: "",
      hireSecurity: "",
      attendeeAffiliation: "",
      roomSetup: "",
      bookingType: "",
      secondaryName: "",
      otherDepartment: "",
      firstName: getDefaultValue("preferred_first_name"),
      lastName: getDefaultValue("preferred_last_name"),
      nNumber: getDefaultValue("university_id"),
      netId: getDefaultValue("netid"),
      ...formData, // restore answers if navigating between form pages
      // copy department + role from earlier in form
      department,
      role,
    },
    mode: "onBlur",
    resolver: undefined,
  });

  // different from other switches b/c services don't have yes/no columns in DB
  const [showEquipmentServices, setShowEquipmentServices] = useState(false);
  const [showStaffingServices, setShowStaffingServices] = useState(false);

  // agreements, skip for walk-ins
  const [checkedAgreements, setCheckedAgreements] = useState<
    Record<string, boolean>
  >(
    Object.fromEntries(agreements.map((agreement) => [agreement.id, isWalkIn]))
  );

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

  const maxCapacity = useMemo(
    () =>
      selectedRooms.reduce((sum, room) => {
        return sum + parseInt(room.capacity);
      }, 0),
    [selectedRooms]
  );

  const validateExpectedAttendance = useCallback(
    (value: string) => {
      const attendance = parseInt(value);
      console.log(attendance, maxCapacity);
      if (isNaN(attendance)) {
        return "Enter a number";
      }
      if (attendance <= 0) {
        return "Expected attendance must be >= 1";
      }
      return (
        attendance <= maxCapacity ||
        `Expected attendance exceeds maximum capacity of ${maxCapacity}`
      );
    },
    [maxCapacity]
  );

  // Add a state to store sponsor API data
  const [sponsorApiData, setSponsorApiData] = useState<UserApiData | null>(
    null
  );
  // Add a state to track if we're currently fetching sponsor data
  const [isFetchingSponsor, setIsFetchingSponsor] = useState(false);

  // Add a function to fetch sponsor data by email
  const fetchSponsorByEmail = useCallback(async (email: string) => {
    if (!email || !email.endsWith("@nyu.edu")) return;

    // Extract netId from email (assuming format is netId@nyu.edu)
    const netId = email.split("@")[0];
    if (!netId) return;

    setIsFetchingSponsor(true);
    try {
      const response = await fetch(`/api/nyu/identity/${netId}`);
      if (response.ok) {
        const data = await response.json();
        setSponsorApiData(data);
        return data;
      }
    } catch (err) {
      console.error("Failed to fetch sponsor data:", err);
    } finally {
      setIsFetchingSponsor(false);
    }
    return null;
  }, []);

  // Enhanced sponsor email validation
  const validateSponsorEmail = useCallback(
    async (value: string) => {
      if (value === userEmail) {
        return "Sponsor email cannot be your own email";
      }

      // Only proceed with API validation if it's an NYU email
      if (value && value.endsWith("@nyu.edu")) {
        const data = await fetchSponsorByEmail(value);

        // Check if the sponsor is a student
        if (data) {
          const sponsorRole = mapAffiliationToRole(data.affiliation_sub_type);
          if (sponsorRole === Role.STUDENT) {
            return "Sponsor cannot be a student";
          }
        }
      }

      return true;
    },
    [userEmail, fetchSponsorByEmail]
  );

  // Watch the sponsor email field specifically
  const sponsorEmail = watch("sponsorEmail");

  // Only fetch sponsor data when the sponsor email changes
  useEffect(() => {
    // Only fetch if there's a valid email and it's an NYU email
    if (
      sponsorEmail &&
      sponsorEmail.endsWith("@nyu.edu") &&
      sponsorEmail !== userEmail
    ) {
      fetchSponsorByEmail(sponsorEmail);
    }
  }, [sponsorEmail, fetchSponsorByEmail, userEmail]);

  // Remove the API call from the validation function since we're now handling it separately
  const validateSponsorEmailSimple = useCallback(
    (value: string) => {
      if (value === userEmail) {
        return "Sponsor email cannot be your own email";
      }

      // Use the already fetched data for validation
      if (sponsorApiData && value.endsWith("@nyu.edu")) {
        const sponsorRole = mapAffiliationToRole(
          roleMapping,
          sponsorApiData.affiliation_sub_type
        );
        if (sponsorRole === Role.STUDENT) {
          return "Sponsor cannot be a student";
        }
      }

      return true;
    },
    [userEmail, sponsorApiData]
  );

  useEffect(() => {
    if (userApiData && isFullForm) {
      reset((formValues) => ({
        ...formValues,
        firstName: userApiData.preferred_first_name || formValues.firstName,
        lastName: userApiData.preferred_last_name || formValues.lastName,
        nNumber: userApiData.university_id || formValues.nNumber,
        netId: userApiData.netid || formValues.netId,
      }));
    }
  }, [userApiData, reset]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Add a ref to track submission state to prevent race conditions
  const isSubmittingRef = useRef(false);

  // Only check if there are agreements to submit
  const agreementsChecked =
    checkedAgreements.length &&
    Object.values(checkedAgreements).every((value) => value);

  const disabledButton =
    agreementsChecked ||
    isBanned ||
    needsSafetyTraining ||
    isInBlackoutPeriod ||
    isSubmitting;

  const onSubmit: SubmitHandler<Inputs> = (data) => {
    // Prevent multiple submissions using ref
    if (isSubmittingRef.current || !bookingCalendarInfo) return;

    // Set both state and ref immediately
    setIsSubmitting(true);
    isSubmittingRef.current = true;

    registerEvent(data, isAutoApproval, calendarEventId)
      .catch((error) => {
        console.error("Error submitting booking:", error);
      })
      .finally(() => {
        if (isMod) {
          router.push(`/${tenant}/modification/confirmation`);
        } else {
          router.push(
            isWalkIn
              ? `/${tenant}/walk-in/confirmation`
              : isVIP
                ? `/${tenant}/vip/confirmation`
                : `/${tenant}/book/confirmation`
          );
        }
      });
  };

  // Modify the form submission to use a wrapper that prevents multiple submissions
  const handleFormSubmit = (e) => {
    // If already submitting, prevent the default form submission
    if (isSubmittingRef.current) {
      e.preventDefault();
      return false;
    }

    // Otherwise, proceed with the normal form submission
    return handleSubmit(onSubmit)(e);
  };

  const prefix = isVIP ? "VIP" : isWalkIn ? "Walk-In" : "";
  const formatSectionTitle = (title: string) => {
    return `${prefix} ${title}`.trim();
  };

  const formatFieldLabel = (label: string) => {
    return `${prefix} ${label}`.trim();
  };

  const fullFormFields = (
    <>
      <Section title={formatSectionTitle("Contact Information")}>
        <BookingFormTextField
          id="firstName"
          label="First Name"
          {...{ control, errors, trigger }}
        />
        <BookingFormTextField
          id="lastName"
          label="Last Name"
          {...{ control, errors, trigger }}
        />
        <BookingFormTextField
          id="secondaryName"
          label="Secondary Point of Contact"
          description="If the person submitting this request is not the Point of Contact for the reservation, please add their name and contact information here (i.e. event organizer, faculty member, etc.)"
          required={false}
          {...{ control, errors, trigger }}
        />
        {showNNumber && !isVIP && (
          // TODO: Refactor this when design schema for inputs
          <BookingFormTextField
            id="nNumber"
            label={formatFieldLabel("NYU N-Number")}
            description="Your N-number begins with a capital 'N' followed by eight digits."
            required
            pattern={{
              value: /N[0-9]{8}$/,
              message: "Invalid N-Number",
            }}
            {...{ control, errors, trigger }}
          />
        )}
        {showSponsor && (
          <BookingFormTextField
            id="netId"
            label={formatFieldLabel("NYU Net ID")}
            // TODO: Refactor this when design schema for inputs
            description={
              isVIP
                ? "The VIP Net ID is the username portion of the VIP's official NYU email address. It begins with the VIP's initials followed by one or more numbers."
                : "Your Net ID is the username portion of your official NYU email address. It begins with your initials followed by one or more numbers."
            }
            required
            pattern={{
              value: /^[a-zA-Z]{2,3}[0-9]{1,6}$/,
              message: "Invalid Net ID",
            }}
            {...{ control, errors, trigger }}
          />
        )}
        <BookingFormTextField
          id="phoneNumber"
          label={formatFieldLabel("Phone Number")}
          required
          pattern={{
            value:
              /^\(?([2-9][0-8][0-9])\)?[-. ]?([2-9][0-9]{2})[-. ]?([0-9]{4})$/,
            message: "Please enter a valid 10 digit telephone number.",
          }}
          {...{ control, errors, trigger }}
        />
      </Section>

      {showSponsor && watch("role") === "Student" && (
        <Section title={formatSectionTitle("Sponsor")}>
          <BookingFormTextField
            id="sponsorFirstName"
            label="Sponsor First Name"
            description="Faculty, Staff, or Liaison related to your request."
            required={watch("role") === Role.STUDENT}
            {...{ control, errors, trigger }}
          />

          <BookingFormTextField
            id="sponsorLastName"
            label="Sponsor Last Name"
            required={watch("role") === Role.STUDENT}
            {...{ control, errors, trigger }}
          />

          <BookingFormTextField
            id="sponsorEmail"
            label="Sponsor Email"
            description="Must be an nyu.edu email address."
            required={watch("role") === Role.STUDENT}
            pattern={{
              value: /^[A-Z0-9._%+-]+@nyu.edu$/i,
              message: "Invalid email address",
            }}
            validate={validateSponsorEmailSimple}
            {...{ control, errors, trigger }}
          />
        </Section>
      )}

      <Section title={formatSectionTitle("Reservation Details")}>
        <BookingFormTextField
          id="title"
          label="Reservation Title"
          description="Please provide a short title for your reservation (25 character limit)."
          fieldProps={{
            inputProps: { maxLength: 25 },
          }}
          {...{ control, errors, trigger }}
        />
        <BookingFormTextField
          id="description"
          label="Reservation Description"
          {...{ control, errors, trigger }}
        />
        {showBookingTypes && (
          <BookingFormDropdown
            id="bookingType"
            label="Booking Type"
            options={settings.bookingTypes
              .map((x) => x.bookingType)
              .sort((a, b) => a.localeCompare(b))}
            dataTestId="booking-type-select"
            {...{ control, errors, trigger }}
          />
        )}
        <BookingFormTextField
          id="expectedAttendance"
          label="Expected Attendance"
          validate={validateExpectedAttendance}
          {...{ control, errors, trigger }}
        />
        <BookingFormDropdown
          id="attendeeAffiliation"
          label="Attendee Affiliation(s)"
          options={Object.values(AttendeeAffiliation)}
          description={
            <p>
              Non-NYU guests will need to be sponsored through JRNY. For more
              information about visitor, vendor, and affiliate access,
              <a
                href="https://www.nyu.edu/about/visitor-information/sponsoring-visitors.html"
                className="text-blue-600 hover:underline dark:text-blue-500 mx-1"
                target="_blank"
              >
                click here
              </a>
              .
            </p>
          }
          dataTestId="attendee-affiliation-select"
          {...{ control, errors, trigger }}
        />
      </Section>

      <Section title={formatSectionTitle("Services")}>
        {!isWalkIn && showSetup && (
          <div style={{ marginBottom: 32 }}>
            <BookingFormSwitch
              id="roomSetup"
              label="Setup?"
              required={false}
              description={
                <p>
                  This field is for requesting a room setup that requires hiring
                  CBS through a work order.
                </p>
              }
              {...{ control, errors, trigger }}
            />
            {watch("roomSetup") === "yes" && (
              <>
                <BookingFormTextField
                  id="setupDetails"
                  label="Room Setup Details"
                  description="Please specify the number of chairs, tables, and your preferred room configuration."
                  {...{ control, errors, trigger }}
                />
                <BookingFormTextField
                  id="chartFieldForRoomSetup"
                  label="ChartField for Room Setup"
                  {...{ control, errors, trigger }}
                />
              </>
            )}
          </div>
        )}
        {showEquipment && (
          <div style={{ marginBottom: 32 }}>
            <BookingFormEquipmentServices
              id="equipmentServices"
              {...{
                control,
                trigger,
                showEquipmentServices,
                setShowEquipmentServices,
                formContext,
              }}
            />
            {watch("equipmentServices") !== undefined &&
              watch("equipmentServices").length > 0 && (
                <BookingFormTextField
                  id="equipmentServicesDetails"
                  label="Equipment Services Details"
                  description={
                    <p>
                      If you selected Equipment Services above, please describe
                      your needs in detail.
                      <br />
                      If you need to check out equipment, you can check our
                      inventory and include your request below. (Ie. 2x Small
                      Mocap Suits)
                      <br />-{" "}
                      <a
                        href="https://sites.google.com/nyu.edu/370jmediacommons/rental-inventory"
                        target="_blank"
                        className="text-blue-600 hover:underline dark:text-blue-500 mx-1"
                      >
                        Media Commons Inventory
                      </a>
                      <br />
                    </p>
                  }
                  {...{ control, errors, trigger }}
                />
              )}
          </div>
        )}
        {showStaffing && (
          <div style={{ marginBottom: 32 }}>
            <BookingFormStaffingServices
              id="staffingServices"
              {...{
                control,
                trigger,
                showStaffingServices,
                setShowStaffingServices,
                formContext,
              }}
            />
            {watch("staffingServices") !== undefined &&
              watch("staffingServices").length > 0 && (
                <BookingFormTextField
                  id="staffingServicesDetails"
                  label="Staffing Services Details"
                  description={
                    <p>
                      If you selected any Staffing Services above, please
                      describe your needs in detail.
                      <br />
                      Please specify the type of technical support you require
                      and any specific requirements for your event.
                    </p>
                  }
                  {...{ control, errors, trigger }}
                />
              )}
          </div>
        )}
        {!isWalkIn && showCatering && (
          <div style={{ marginBottom: 32 }}>
            <BookingFormSwitch
              id="catering"
              label="Catering?"
              description={<p>Select if you need catering for your event.</p>}
              required={false}
              {...{ control, errors, trigger }}
            />
            {watch("catering") === "yes" && (
              <>
                <BookingFormDropdown
                  id="cateringService"
                  label="Catering Service"
                  options={["Outside Catering", "NYU Plated"]}
                  {...{ control, errors, trigger }}
                />
                <BookingFormTextField
                  id="chartFieldForCatering"
                  label="ChartField for Catering Services"
                  {...{ control, errors, trigger }}
                />
              </>
            )}
          </div>
        )}
        {!isWalkIn && showCleaning && (
          <div style={{ marginBottom: 32 }}>
            <BookingFormSwitch
              id="cleaningService"
              label="Cleaning?"
              description={
                <p>Select if you need cleaning services for your event.</p>
              }
              required={false}
              {...{ control, errors, trigger }}
            />
            {watch("cleaningService") === "yes" && (
              <BookingFormTextField
                id="chartFieldForCleaning"
                label="ChartField for CBS Cleaning Services"
                {...{ control, errors, trigger }}
              />
            )}
          </div>
        )}
        {!isWalkIn && showHireSecurity && (
          <div style={{ marginBottom: 32 }}>
            <BookingFormSwitch
              id="hireSecurity"
              label="Security?"
              required={false}
              description={
                <p>
                  Only for large events with 75+ attendees, and bookings in The
                  Garage where the Willoughby entrance will be in use. It is
                  required for the reservation holder to provide a chartfield so
                  that the Media Commons Team can obtain Campus Safety Security
                  Services.
                </p>
              }
              {...{ control, errors, trigger }}
            />
            {watch("hireSecurity") === "yes" && (
              <BookingFormTextField
                id="chartFieldForSecurity"
                label="ChartField for Security"
                {...{ control, errors, trigger }}
              />
            )}
          </div>
        )}
      </Section>

      {isBooking && (
        <Section title="Agreement">
          {agreements.map((agreement) => (
            <BookingFormAgreementCheckbox
              key={agreement.id}
              id={agreement.id}
              checked={checkedAgreements[agreement.id]}
              onChange={(value) =>
                setCheckedAgreements({
                  ...checkedAgreements,
                  [agreement.id]: value,
                })
              }
              description={
                <div dangerouslySetInnerHTML={{ __html: agreement.html }} />
              }
            />
          ))}
        </Section>
      )}
      <Button type="submit" disabled={disabledButton} variant="contained">
        Submit
      </Button>
    </>
  );

  const modificationFormFields = (
    <>
      <Section title="Reservation Details">
        <BookingFormTextField
          id="title"
          label="Reservation Title"
          description="Please provide a short title for your reservation (25 character limit)."
          fieldProps={{
            inputProps: { maxLength: 25 },
          }}
          {...{ control, errors, trigger }}
        />
        <BookingFormTextField
          id="description"
          label="Reservation Description"
          {...{ control, errors, trigger }}
        />
        <BookingFormTextField
          id="expectedAttendance"
          label="Expected Attendance"
          validate={validateExpectedAttendance}
          {...{ control, errors, trigger }}
        />
      </Section>
      <Section title="Services">
        <div style={{ marginBottom: 32 }}>
          <BookingFormEquipmentServices
            id="equipmentServices"
            {...{
              control,
              trigger,
              showEquipmentServices,
              setShowEquipmentServices,
              formContext,
            }}
          />
          {watch("equipmentServices") !== undefined &&
            watch("equipmentServices").length > 0 && (
              <BookingFormTextField
                id="equipmentServicesDetails"
                label="Equipment Services Details"
                {...{ control, errors, trigger }}
              />
            )}
        </div>
        <div style={{ marginBottom: 32 }}>
          <BookingFormStaffingServices
            id="staffingServices"
            {...{
              control,
              trigger,
              showStaffingServices,
              setShowStaffingServices,
              formContext,
            }}
          />
          {watch("staffingServices") !== undefined &&
            watch("staffingServices").length > 0 && (
              <BookingFormTextField
                id="staffingServicesDetails"
                label="Staffing Services Details"
                {...{ control, errors, trigger }}
              />
            )}
        </div>
      </Section>
      <Button type="submit" disabled={!isValid} variant="contained">
        Submit
      </Button>
    </>
  );

  let formFields = <></>;
  switch (formContext) {
    case FormContextLevel.MODIFICATION:
      formFields = modificationFormFields;
      break;
    default:
      formFields = fullFormFields;
  }

  return (
    <Center>
      <Container padding={8} marginTop={4} marginBottom={6}>
        <BookingSelection />
        <form onSubmit={handleFormSubmit}>{formFields}</form>
      </Container>
    </Center>
  );
}
