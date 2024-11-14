import {
  BookingFormAgreementCheckbox,
  BookingFormDropdown,
  BookingFormSwitch,
  BookingFormTextField,
} from "./BookingFormInputs";
import { Button, Typography } from "@mui/material";
import { FormContextLevel, Inputs, Role } from "@/components/src/types";
import { useCallback, useContext, useMemo, useState } from "react";

import { AttendeeAffiliation } from "@/components/src/typesMediaCommons";
import { BookingContext } from "../../../providers/BookingFormProvider";
import BookingFormMediaServices from "./BookingFormMediaServices";
import { UseFormReturn } from "react-hook-form";
import { useAuth } from "../../../providers/AuthProvider";
import { useMediaCommonsDatabase } from "../../../providers/MediaCommonsDatabaseProvider";

const Section = ({ title, children }) => (
  <div style={{ marginBottom: "20px" }}>
    <Typography variant="h5" style={{ marginBottom: "8px" }}>
      {title}
    </Typography>
    <div>{children}</div>
  </div>
);

interface Props {
  formContext: FormContextLevel;
  formReturn: UseFormReturn<Inputs, any, undefined>;
}

export default function FormInputsMediaCommons({
  formContext,
  formReturn,
}: Props) {
  const { selectedRooms, isBanned, needsSafetyTraining } =
    useContext(BookingContext);
  const { settings } = useMediaCommonsDatabase();
  const { userEmail } = useAuth();

  // different from other switches b/c mediaServices doesn't have yes/no column in DB
  const [showMediaServices, setShowMediaServices] = useState(false);

  const isWalkIn = formContext === FormContextLevel.WALK_IN;

  // agreements, skip for walk-ins
  const [checklist, setChecklist] = useState(isWalkIn);
  const [resetRoom, setResetRoom] = useState(isWalkIn);
  const [bookingPolicy, setBookingPolicy] = useState(isWalkIn);

  const disabledButton =
    !(
      checklist &&
      resetRoom &&
      bookingPolicy &&
      formReturn.formState.isValid
    ) ||
    isBanned ||
    needsSafetyTraining;

  const {
    control,
    handleSubmit,
    trigger,
    watch,
    formState: { errors, isValid },
  } = formReturn;

  const maxCapacity = useMemo(
    () =>
      selectedRooms.reduce((sum, room) => {
        return sum + parseInt(room.capacity);
      }, 0),
    [selectedRooms]
  );

  const validateTitleLength = (value: string) => {
    if (value.trim().length > 40) {
      return "Must be less than 40 characters";
    }
    return true;
  };

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

  const validateSponsorEmail = useCallback(
    (value: string) => {
      if (value === userEmail) {
        return "Sponsor email cannot be your own email";
      }
      return true;
    },
    [userEmail]
  );

  const fullFormFields = (
    <>
      <Section title="Contact Information">
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
        <BookingFormTextField
          id="nNumber"
          label="NYU N-Number"
          description="Your N-number begins with a capital 'N' followed by eight digits."
          required
          pattern={{
            value: /N[0-9]{8}$/,
            message: "Invalid N-Number",
          }}
          {...{ control, errors, trigger }}
        />

        <BookingFormTextField
          id="netId"
          label="NYU Net ID"
          description="Your Net ID is the username portion of your official NYU email address. It begins with your initials followed by one or more numbers."
          required
          pattern={{
            value: /[a-zA-Z]{1,3}[0-9]{1,6}/,
            message: "Invalid Net ID",
          }}
          {...{ control, errors, trigger }}
        />

        <BookingFormTextField
          id="phoneNumber"
          label="Phone Number"
          required
          pattern={{
            value:
              /^\(?([2-9][0-8][0-9])\)?[-. ]?([2-9][0-9]{2})[-. ]?([0-9]{4})$/,
            message: "Please enter a valid 10 digit telephone number.",
          }}
          {...{ control, errors, trigger }}
        />
      </Section>

      {watch("role") === "Student" && (
        <Section title="Sponsor">
          <BookingFormTextField
            id="sponsorFirstName"
            label="Sponsor First Name"
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
            validate={validateSponsorEmail}
            {...{ control, errors, trigger }}
          />
        </Section>
      )}

      <Section title="Reservation Details">
        <BookingFormTextField
          id="title"
          label="Reservation Title"
          validate={validateTitleLength}
          {...{ control, errors, trigger }}
        />
        <BookingFormTextField
          id="description"
          label="Reservation Description"
          {...{ control, errors, trigger }}
        />
        <BookingFormDropdown
          id="bookingType"
          label="Booking Type"
          options={settings.bookingTypes
            .map((x) => x.bookingType)
            .sort((a, b) => a.localeCompare(b))}
          {...{ control, errors, trigger }}
        />
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
          {...{ control, errors, trigger }}
        />
      </Section>

      <Section title="Services">
        {!isWalkIn && (
          <div style={{ marginBottom: 32 }}>
            <BookingFormSwitch
              id="roomSetup"
              label="Room Setup Needed?"
              required={false}
              description={<p></p>}
              {...{ control, errors, trigger }}
            />
            {watch("roomSetup") === "yes" && (
              <>
                <BookingFormTextField
                  id="setupDetails"
                  label="Room Setup Details"
                  description="If you requested Room Setup and are not using rooms 233 or 1201, please explain your needs including # of chairs, # tables, and formation."
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
        <div style={{ marginBottom: 32 }}>
          <BookingFormMediaServices
            id="mediaServices"
            {...{
              control,
              trigger,
              showMediaServices,
              setShowMediaServices,
              formContext,
            }}
          />
          {watch("mediaServices") !== undefined &&
            watch("mediaServices").length > 0 && (
              <BookingFormTextField
                id="mediaServicesDetails"
                label="Media Services Details"
                description={
                  <p>
                    If you selected any of the Media Services above, please
                    describe your needs in detail.
                    <br />
                    If you need to check out equipment, you can check our
                    inventory and include your request below. (Ie. 2x Small
                    Mocap Suits)
                    <br />-{" "}
                    <a
                      href="https://docs.google.com/document/d/1oRtvZ0SR52Mq_ykoNXelwqat4JFgdado5JDY6A746VY/edit#heading=h.iv9c7z15bn0t"
                      target="_blank"
                      className="text-blue-600 hover:underline dark:text-blue-500 mx-1"
                    >
                      Inventory for Black Box 220 and Ballrooms 221-224
                    </a>
                    <br />-{" "}
                    <a
                      href="https://docs.google.com/spreadsheets/d/1fziyVrzeytQJyZ8585Wtqxer-PBt6L-u-Z0LHVavK5k/edit#gid=870626522"
                      target="_blank"
                      className="text-blue-600 hover:underline dark:text-blue-500 mx-1"
                    >
                      Inventory for Garage 103
                    </a>
                    <br />
                  </p>
                }
                {...{ control, errors, trigger }}
              />
            )}
        </div>
        {!isWalkIn && (
          <div style={{ marginBottom: 32 }}>
            <BookingFormSwitch
              id="catering"
              label="Catering?"
              description={<p></p>}
              required={false}
              {...{ control, errors, trigger }}
            />
            {watch("catering") === "yes" && (
              <>
                <BookingFormDropdown
                  id="cateringService"
                  label="Catering Information"
                  options={["Outside Catering", "NYU Plated"]}
                  {...{ control, errors, trigger }}
                />
                <BookingFormTextField
                  id="chartFieldForCatering"
                  label="ChartField for CBS Cleaning Services"
                  {...{ control, errors, trigger }}
                />
              </>
            )}
          </div>
        )}
        {!isWalkIn && (
          <div style={{ marginBottom: 32 }}>
            <BookingFormSwitch
              id="hireSecurity"
              label="Hire Security?"
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

      {!isWalkIn && (
        <Section title="Agreement">
          <BookingFormAgreementCheckbox
            id="checklist"
            checked={checklist}
            onChange={setChecklist}
            description={
              <p>
                {" "}
                I confirm receipt of the
                <a
                  href="https://docs.google.com/document/d/1TIOl8f8-7o2BdjHxHYIYELSb4oc8QZMj1aSfaENWjR8/edit#heading=h.ns3jisyhutvq"
                  target="_blank"
                  className="text-blue-600 hover:underline dark:text-blue-500 mx-1 mx-1"
                >
                  370J Media Commons Event Service Rates/Additional Information
                </a>
                document that contains information regarding event needs and
                services. I acknowledge that it is my responsibility to set up
                catering and Campus Media if needed for my reservation. I
                understand that the 370J Media Commons Operations staff will
                setup CBS cleaning services, facilitate hiring security, and
                arrange room setup services if needed for my reservation.
              </p>
            }
          />
          <BookingFormAgreementCheckbox
            id="resetRoom"
            checked={resetRoom}
            onChange={setResetRoom}
            description={
              <p>
                I agree to reset all rooms and common spaces I have used to
                their original state at the end of my reservation, including
                returning equipment, resetting furniture, and cleaning up after
                myself. I will notify Media Commons staff of any problems,
                damage, or other concerns affecting the condition and
                maintenance of the reserved space. I understand that if I do not
                reset the room, I may lose access to the Media Commons.
              </p>
            }
          />
          <BookingFormAgreementCheckbox
            id="bookingPolicy"
            checked={bookingPolicy}
            onChange={setBookingPolicy}
            description={
              <p>
                I have read the
                <a
                  href="https://docs.google.com/document/d/1vAajz6XRV0EUXaMrLivP_yDq_LyY43BvxOqlH-oNacc/edit"
                  target="_blank"
                  className="text-blue-600 hover:underline dark:text-blue-500 mx-1 mx-1"
                >
                  Booking Policy for 370J Media Commons
                </a>
                and agree to follow all policies outlined. I understand that I
                may lose access to the Media Commons if I break this agreement.
              </p>
            }
          />
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
          id="expectedAttendance"
          label="Expected Attendance"
          validate={validateExpectedAttendance}
          {...{ control, errors, trigger }}
        />
      </Section>
      <Section title="Media Services">
        <div style={{ marginBottom: 32 }}>
          <BookingFormMediaServices
            id="mediaServices"
            {...{
              control,
              trigger,
              showMediaServices,
              setShowMediaServices,
              formContext,
            }}
          />
          {watch("mediaServices") !== undefined &&
            watch("mediaServices").length > 0 && (
              <BookingFormTextField
                id="mediaServicesDetails"
                label="Media Services Details"
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

  return formFields;
}