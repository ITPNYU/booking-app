import { Button, Typography } from "@mui/material";
import { ChevronRight } from "@mui/icons-material";
import { useCallback, useContext, useEffect, useMemo, useState } from "react";

import { useParams, useRouter } from "next/navigation";
import { BookingFormDropdown, BookingFormTextField } from "./BookingFormInputs";
import {
  AttendeeAffiliation,
  FormContextLevel,
  Role,
  UserApiData,
} from "../../../../types";
import {
  isValidNetIdEmailFormat,
  NET_ID_EMAIL_REGEX,
  NET_ID_REGEX,
} from "../../../../utils/validationHelpers";
import {
  getRequestOrigin,
  withOriginPrefix,
} from "../../../../utils/serviceSections";
import { DatabaseContext } from "../../components/Provider";
import { useTenantSchema } from "../../components/SchemaProvider";
import { BookingContext } from "../bookingProvider";
import { mapAffiliationToRole } from "../formPages/UserRolePage";
import { useHasServicesStep } from "../hooks/useFormSteps";
import useRequestFormState from "../hooks/useRequestFormState";
import useSubmitRequest from "../hooks/useSubmitRequest";
import { buildBookingUrl } from "../utils/bookingUrlParser";
import { formContextToFlowType } from "../utils/formSteps";
import { RequestFormShell, Section } from "./RequestFormShell";
import SubmitBlock, { useRequestBlocked } from "./SubmitBlock";

interface Props {
  calendarEventId?: string;
  formContext: FormContextLevel;
  userApiData?: UserApiData;
}

/**
 * The Details step: contact information, sponsor and reservation details.
 * Ends with Next when the Services step follows, or with the submit block
 * when Services is skipped for this request.
 */
export default function DetailsInput({
  calendarEventId,
  formContext,
  userApiData,
}: Props) {
  const { userEmail, settings } = useContext(DatabaseContext);
  const { selectedRooms, formData, setIsDetailsValid } =
    useContext(BookingContext);
  const blocked = useRequestBlocked();
  const router = useRouter();
  const { tenant } = useParams();

  const { isWalkIn, isMod, isFullForm, isVIP } = getRequestOrigin(
    formContext,
    formData?.origin,
  );

  const hasServicesStep = useHasServicesStep(formContext);
  const { isSubmitting, createSubmitHandler } = useSubmitRequest(
    formContext,
    calendarEventId,
  );

  const {
    form: { showNNumber, showSponsor, showBookingType },
    mappings: { role: roleMapping },
  } = useTenantSchema();

  const {
    control,
    handleSubmit,
    trigger,
    watch,
    reset,
    formState: { errors, isValid },
  } = useRequestFormState({ userApiData, isVIP, isWalkIn });

  // The missing-data guard lets a request onto Services only while the
  // Details answer set is valid.
  useEffect(() => {
    setIsDetailsValid(isValid);
  }, [isValid, setIsDetailsValid]);

  const maxCapacity = useMemo(
    () => selectedRooms.reduce((sum, room) => sum + parseInt(room.capacity), 0),
    [selectedRooms],
  );

  const validateExpectedAttendance = useCallback(
    (value: string) => {
      const attendance = parseInt(value);
      if (isNaN(attendance)) {
        return "Enter a number";
      }
      if (attendance <= 0) {
        return "Expected attendance must be >= 1";
      }
      // Only validate capacity if rooms are selected and have valid capacity
      if (maxCapacity > 0) {
        return (
          attendance <= maxCapacity ||
          `Expected attendance exceeds maximum capacity of ${maxCapacity}`
        );
      }
      return true;
    },
    [maxCapacity],
  );

  // Add a state to store sponsor API data
  const [sponsorApiData, setSponsorApiData] = useState<UserApiData | null>(
    null,
  );

  // Watch sponsor email field specifically
  const sponsorEmail = watch("sponsorEmail");

  // Fetch sponsor data when email changes to a valid NYU Net ID email.
  // Clears stale data immediately on change and aborts any in-flight request.
  useEffect(() => {
    const normalizedSponsorEmail = sponsorEmail?.trim().toLowerCase();
    const normalizedUserEmail = userEmail?.trim().toLowerCase();

    // Always clear stale sponsor data when the email field changes
    setSponsorApiData(null);

    if (
      !normalizedSponsorEmail ||
      !isValidNetIdEmailFormat(normalizedSponsorEmail) ||
      normalizedSponsorEmail === normalizedUserEmail
    ) {
      return;
    }

    const controller = new AbortController();
    const netId = normalizedSponsorEmail.split("@")[0];

    fetch(`/api/nyu/identity/${netId}`, { signal: controller.signal })
      .then(async (res) => {
        if (res.ok) {
          const data = await res.json();
          setSponsorApiData(data);
        }
      })
      .catch((err) => {
        if (err.name !== "AbortError") {
          console.error("Failed to fetch sponsor data:", err);
        }
      });

    return () => controller.abort();
  }, [sponsorEmail, userEmail]);

  // Remove the API call from the validation function since we're now handling it separately
  const validateSponsorEmailSimple = useCallback(
    (value: string) => {
      const normalizedValue = value?.trim().toLowerCase();
      const normalizedUserEmail = userEmail?.trim().toLowerCase();

      if (normalizedValue === normalizedUserEmail) {
        return "Sponsor email cannot be your own email";
      }

      // Use the already fetched data for validation
      if (
        sponsorApiData &&
        normalizedValue &&
        isValidNetIdEmailFormat(normalizedValue)
      ) {
        const sponsorRole = mapAffiliationToRole(
          roleMapping,
          sponsorApiData.affiliation_sub_type,
        );
        if (sponsorRole === Role.STUDENT) {
          return "Sponsor cannot be a student";
        }
      }

      return true;
    },
    [userEmail, sponsorApiData, roleMapping],
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
  }, [userApiData, reset, isFullForm]);

  // Next is gated by the same rule Submit uses: modifications need a valid
  // form; other requests are blocked by bans, safety training and blackouts.
  const nextDisabled = isMod ? !isValid : blocked;

  const goToServices = () => {
    router.push(
      buildBookingUrl(
        String(tenant),
        formContextToFlowType(formContext),
        "services",
        calendarEventId,
      ),
    );
  };

  const onFormSubmit = hasServicesStep
    ? handleSubmit(goToServices)
    : createSubmitHandler(handleSubmit);

  const origin = getRequestOrigin(formContext, formData?.origin);
  const formatSectionTitle = (title: string) => withOriginPrefix(origin, title);
  const formatFieldLabel = (label: string) => withOriginPrefix(origin, label);

  const formFields = (
    <>
      {/* Contact Information - only for full form, not for modification */}
      {!isMod && (
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
          <div style={{ marginTop: 20 }}>
            <Typography
              variant="body1"
              style={{ fontWeight: 500, marginBottom: 8 }}
            >
              Secondary Point of Contact
            </Typography>
            <Typography variant="body2" style={{ marginBottom: 16 }}>
              If the person submitting this request is not the Point of Contact
              for the reservation, please add their name and contact information
              here (i.e. event organizer, faculty member, etc.)
            </Typography>
            <BookingFormTextField
              id="secondaryFirstName"
              label="Secondary First Name"
              required={false}
              {...{ control, errors, trigger }}
            />
            <BookingFormTextField
              id="secondaryLastName"
              label="Secondary Last Name"
              required={false}
              {...{ control, errors, trigger }}
            />
            <BookingFormTextField
              id="secondaryEmail"
              label="Secondary Email (NYU Net ID)"
              required={false}
              pattern={{
                value: NET_ID_EMAIL_REGEX,
                message:
                  "Invalid NYU Net ID email format (e.g., abc123@nyu.edu)",
              }}
              description="Enter the NYU email address (e.g., abc123@nyu.edu)"
              {...{ control, errors, trigger }}
            />
          </div>
          {showNNumber && !isVIP && (
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
              description={
                isVIP
                  ? "The VIP Net ID is the username portion of the VIP's official NYU email address. It begins with the VIP's initials followed by one or more numbers."
                  : "Your Net ID is the username portion of your official NYU email address. It begins with your initials followed by one or more numbers."
              }
              required
              pattern={{
                value: NET_ID_REGEX,
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
      )}

      {/* Sponsor - only for full form with student role */}
      {!isMod && showSponsor && watch("role") === Role.STUDENT && (
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
            label="Sponsor Email (NYU Net ID)"
            description="Enter the NYU email address (e.g., abc123@nyu.edu)"
            required={watch("role") === Role.STUDENT}
            pattern={{
              value: NET_ID_EMAIL_REGEX,
              message: "Invalid NYU Net ID email format (e.g., abc123@nyu.edu)",
            }}
            validate={validateSponsorEmailSimple}
            {...{ control, errors, trigger }}
          />
        </Section>
      )}

      {/* Reservation Details - for all form types */}
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
        {!isMod && showBookingType && (
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
        {!isMod && (
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
                  rel="noopener noreferrer"
                >
                  click here (opens in new tab)
                </a>
                .
              </p>
            }
            dataTestId="attendee-affiliation-select"
            {...{ control, errors, trigger }}
          />
        )}
      </Section>

      {hasServicesStep ? (
        <Button
          type="submit"
          variant="contained"
          endIcon={<ChevronRight />}
          disabled={nextDisabled}
        >
          Next
        </Button>
      ) : (
        <SubmitBlock {...{ formContext, isValid, isSubmitting }} />
      )}
    </>
  );

  return (
    <RequestFormShell>
      <form onSubmit={onFormSubmit}>{formFields}</form>
    </RequestFormShell>
  );
}
