import { useContext, useEffect, useMemo, useRef, useState } from "react";

import { BookingFormSwitch, BookingFormTextField } from "./BookingFormInputs";
import { FormContextLevel } from "../../../../types";
import {
  CHARTFIELD_PATTERN_MESSAGE,
  CHARTFIELD_REGEX,
} from "../../../../utils/validationHelpers";
import {
  getResourceServicesConfig,
  getServiceRooms,
} from "../../../../utils/resourceServicesUtils";
import {
  createServiceRuleMemory,
  getRequestOrigin,
  getServiceSectionFlags,
  withOriginPrefix,
} from "../../../../utils/serviceSections";
import { useTenantSchema } from "../../components/SchemaProvider";
import { BookingContext } from "../bookingProvider";
import useRequestFormState from "../hooks/useRequestFormState";
import useSubmitRequest from "../hooks/useSubmitRequest";
import BookingFormEquipmentServices from "./BookingFormEquipmentServices";
import BookingFormResourceServices from "./BookingFormResourceServices";
import BookingFormStaffingServices from "./BookingFormStaffingServices";
import { RequestFormShell, Section } from "./RequestFormShell";
import SubmitBlock from "./SubmitBlock";

interface Props {
  calendarEventId?: string;
  formContext: FormContextLevel;
}

/**
 * The Services step: every service section for the selected rooms and their
 * annex spaces, followed by the submit block. Answers are mirrored into
 * BookingContext like Details does, so the two steps share one answer set.
 */
export default function ServicesInput({ calendarEventId, formContext }: Props) {
  const { selectedRooms, formData, annexByRoom, serviceRuleMemory } =
    useContext(BookingContext);
  // Rule bookkeeping lives in BookingContext so it outlives this step.
  const localRuleMemory = useRef(createServiceRuleMemory());
  const memory = serviceRuleMemory ?? localRuleMemory.current;
  const {
    form: {
      services: { showSetup },
    },
    resources: schemaResources,
  } = useTenantSchema();

  const origin = getRequestOrigin(formContext, formData?.origin);
  const { isWalkIn, isVIP } = origin;

  const { isSubmitting, createSubmitHandler } = useSubmitRequest(
    formContext,
    calendarEventId,
  );

  // Checked annex spaces (e.g. 1200L-6 under 1201) live in annexByRoom, not
  // selectedRooms, but their own services must still be offered on the form.
  const serviceRooms = useMemo(
    () => getServiceRooms(selectedRooms, annexByRoom, schemaResources),
    [selectedRooms, annexByRoom, schemaResources],
  );

  const {
    schemaDrivenServices,
    showGenericSetup,
    showEquipment,
    showLegacyStaffing,
    showLegacyCatering,
    showLegacyCleaning,
    showLegacySecurity,
    needsGenericSecuritySwitch,
    needsCheckboxSecurity,
    cateringDescriptionHtml,
  } = useMemo(
    () => getServiceSectionFlags(serviceRooms, origin, showSetup),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [serviceRooms, isWalkIn, isVIP, showSetup],
  );

  const {
    control,
    handleSubmit,
    trigger,
    watch,
    setValue,
    unregister,
    clearErrors,
    formState: { errors, isValid },
  } = useRequestFormState({ isVIP, isWalkIn });

  // different from other switches b/c services don't have yes/no columns in DB
  const [showEquipmentServices, setShowEquipmentServices] = useState(false);
  const [showStaffingServices, setShowStaffingServices] = useState(false);

  // Initialize service toggles based on existing form data (for modification forms)
  useEffect(() => {
    if (formData) {
      if (formData.equipmentServices && formData.equipmentServices.length > 0) {
        setShowEquipmentServices(true);
      }
      if (formData.staffingServices && formData.staffingServices.length > 0) {
        setShowStaffingServices(true);
      }
    }
  }, []); // Run only once on mount

  // Expected attendance is answered on Details; 75 or more forces security
  // here, shown as a locked toggle. Lowering it on Details unlocks the toggle.
  const expectedAttendanceValue = watch("expectedAttendance");
  const isLargeEvent = parseInt(expectedAttendanceValue || "0") >= 75;
  const cateringValue = watch("catering");
  const cleaningValue = watch("cleaningService");

  const cateringRequiresCleaning = useMemo(
    () =>
      selectedRooms.some(
        (room) =>
          getResourceServicesConfig(room).catering?.forceCleaning === true,
      ),
    [selectedRooms],
  );

  // The rules below only drive the legacy booking-level switches. Rooms with
  // a schema services config get per-room catering / cleaning / security in
  // BookingFormResourceServices, which applies these rules room by room and
  // mirrors the results into the flat fields.
  useEffect(() => {
    if (schemaDrivenServices) return;
    if (cateringValue === "yes" && cateringRequiresCleaning) {
      if (cleaningValue !== "yes") {
        setValue("cleaningService", "yes", { shouldValidate: true });
        memory.cleaningAutoSet = true;
      }
    } else if (memory.cleaningAutoSet && cleaningValue === "yes") {
      setValue("cleaningService", "", { shouldValidate: true });
      memory.cleaningAutoSet = false;
    }
  }, [
    cateringValue,
    cleaningValue,
    setValue,
    cateringRequiresCleaning,
    schemaDrivenServices,
    memory,
  ]);

  // Drop stale catering chartfield errors when the field is hidden.
  useEffect(() => {
    if (cateringValue === "yes") return;
    unregister("chartFieldForCatering");
    clearErrors("chartFieldForCatering");
    setValue("chartFieldForCatering", "", { shouldValidate: false });
  }, [cateringValue, unregister, clearErrors, setValue]);

  const hireSecurityValue = watch("hireSecurity");

  // Detect manual changes to hireSecurity by comparing against the last auto-set value
  useEffect(() => {
    // If we have an auto baseline, and the current value differs, treat as manual override
    if (
      memory.autoHireSecurityValue !== undefined &&
      hireSecurityValue !== memory.autoHireSecurityValue
    ) {
      memory.hireSecurityManuallySet = true;
      memory.hireSecurityAutoSet = false;
      memory.autoHireSecurityValue = undefined;
    }
  }, [hireSecurityValue, memory]);

  useEffect(() => {
    // Per-room security is owned by BookingFormResourceServices.
    if (schemaDrivenServices) return;
    // Do not auto-manage hireSecurity if the user has manually overridden it
    // BUT: if attendance crosses back above threshold (in auto-enabling direction),
    // reset the manual flag and auto-enable again
    if (memory.hireSecurityManuallySet && !isLargeEvent) {
      // User manually changed it, and we're below threshold - respect their choice
      return;
    }

    // Reset manual flag when crossing threshold in auto-enabling direction
    if (isLargeEvent && memory.hireSecurityManuallySet) {
      memory.hireSecurityManuallySet = false;
    }

    if (isLargeEvent && (needsGenericSecuritySwitch || needsCheckboxSecurity)) {
      // Checkbox-mode (Garage Willoughby) uses a distinct value when opted in;
      // for large events force a generic "yes" if security is not already set.
      const alreadyRequested =
        typeof hireSecurityValue === "string" &&
        hireSecurityValue.trim().length > 0 &&
        hireSecurityValue.trim().toLowerCase() !== "no";
      if (!alreadyRequested) {
        setValue("hireSecurity", "yes", { shouldValidate: true });
        memory.hireSecurityAutoSet = true;
        memory.autoHireSecurityValue = "yes";
      }
    } else {
      // Only reset if it was auto-set previously
      if (memory.hireSecurityAutoSet && hireSecurityValue !== "") {
        setValue("hireSecurity", "", { shouldValidate: true });
        memory.hireSecurityAutoSet = false;
        memory.autoHireSecurityValue = "";
      }
    }
  }, [
    isLargeEvent,
    hireSecurityValue,
    setValue,
    needsGenericSecuritySwitch,
    needsCheckboxSecurity,
    schemaDrivenServices,
    memory,
  ]);

  const formatFieldLabel = (label: string) => withOriginPrefix(origin, label);

  return (
    <RequestFormShell>
      <form onSubmit={createSubmitHandler(handleSubmit)}>
        <Section title={withOriginPrefix(origin, "Services")}>
          <BookingFormResourceServices
            selectedRooms={serviceRooms}
            control={control}
            errors={errors}
            trigger={trigger}
            watch={watch}
            setValue={setValue}
            isWalkIn={isWalkIn}
            isVIP={isVIP}
            formatFieldLabel={formatFieldLabel}
            showStaffingServices={showStaffingServices}
            setShowStaffingServices={setShowStaffingServices}
            formContext={formContext}
            isLargeEvent={isLargeEvent}
            ruleMemory={memory}
          />
          {showGenericSetup && (
            <div style={{ marginBottom: 32 }}>
              <BookingFormSwitch
                id="roomSetup"
                label="Room Setup"
                required={false}
                description={
                  <p>
                    This field is for requesting a room setup that requires
                    hiring CBS through a work order.
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
                    required={false}
                    pattern={{
                      value: CHARTFIELD_REGEX,
                      message: CHARTFIELD_PATTERN_MESSAGE,
                    }}
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
                        If you selected Equipment Services above, please
                        describe your needs in detail.
                        <br />
                        If you need to check out equipment, you can check our
                        inventory and include your request below. (Ie. 2x Small
                        Mocap Suits)
                        <br />-{" "}
                        <a
                          href="https://sites.google.com/nyu.edu/370jmediacommons/rental-inventory"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline dark:text-blue-500 mx-1"
                        >
                          Media Commons Inventory (opens in new tab)
                        </a>
                        <br />
                      </p>
                    }
                    {...{ control, errors, trigger }}
                  />
                )}
            </div>
          )}
          {/* Legacy / non-schema rooms: staffing stays booking-level here. */}
          {showLegacyStaffing && (
            <div style={{ marginBottom: 32 }}>
              <BookingFormStaffingServices
                id="staffingServices"
                {...{
                  control,
                  trigger,
                  showStaffingServices,
                  setShowStaffingServices,
                  formContext,
                  setValue,
                }}
              />
            </div>
          )}
          {/* Legacy rooms without object services config keep flat catering/cleaning/security. */}
          {showLegacyCatering && (
            <div style={{ marginBottom: 32 }}>
              <BookingFormSwitch
                id="catering"
                label="Catering?"
                description={
                  cateringDescriptionHtml ? (
                    <div
                      style={{ fontSize: "0.75rem" }}
                      dangerouslySetInnerHTML={{
                        __html: cateringDescriptionHtml,
                      }}
                    />
                  ) : (
                    <p>Select if you need catering for your event.</p>
                  )
                }
                required={false}
                {...{ control, errors, trigger }}
              />
              {cateringValue === "yes" && (
                <BookingFormTextField
                  id="chartFieldForCatering"
                  label="ChartField for Catering Services"
                  required
                  pattern={{
                    value: CHARTFIELD_REGEX,
                    message: CHARTFIELD_PATTERN_MESSAGE,
                  }}
                  {...{ control, errors, trigger }}
                />
              )}
            </div>
          )}
          {showLegacyCleaning && (
            <div style={{ marginBottom: 32 }}>
              <BookingFormSwitch
                id="cleaningService"
                label="Cleaning?"
                description={
                  <p>Select if you need cleaning services for your event.</p>
                }
                required={false}
                disabled={cateringValue === "yes" && cateringRequiresCleaning}
                {...{ control, errors, trigger }}
              />
              {watch("cleaningService") === "yes" && (
                <BookingFormTextField
                  id="chartFieldForCleaning"
                  label="ChartField for CBS Cleaning Services"
                  required={false}
                  pattern={{
                    value: CHARTFIELD_REGEX,
                    message: CHARTFIELD_PATTERN_MESSAGE,
                  }}
                  {...{ control, errors, trigger }}
                />
              )}
            </div>
          )}
          {showLegacySecurity && (
            <div style={{ marginBottom: 32 }}>
              <BookingFormSwitch
                id="hireSecurity"
                label="Security?"
                required={false}
                disabled={isLargeEvent}
                description={
                  <p>
                    {isLargeEvent && (
                      <span
                        style={{
                          display: "block",
                          marginBottom: "4px",
                          fontWeight: 500,
                        }}
                      >
                        Security is required for events with more than 75
                        attendees.
                      </span>
                    )}
                    Only for large events with 75+ attendees, and bookings in
                    The Garage where the Willoughby entrance will be in use. It
                    is required for the reservation holder to provide a
                    chartfield so that the Media Commons Team can obtain Campus
                    Safety Security Services.
                  </p>
                }
                {...{ control, errors, trigger }}
              />
              {watch("hireSecurity") === "yes" && (
                <BookingFormTextField
                  id="chartFieldForSecurity"
                  label="ChartField for Security"
                  required={false}
                  pattern={{
                    value: CHARTFIELD_REGEX,
                    message: CHARTFIELD_PATTERN_MESSAGE,
                  }}
                  {...{ control, errors, trigger }}
                />
              )}
            </div>
          )}
        </Section>

        <SubmitBlock {...{ formContext, isValid, isSubmitting }} />
      </form>
    </RequestFormShell>
  );
}
