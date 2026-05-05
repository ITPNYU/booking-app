import {
  FormControlLabel,
  FormHelperText,
  Switch,
  Radio,
  RadioGroup,
  FormControl,
  FormLabel,
} from "@mui/material";
import {
  Control,
  Controller,
  FieldErrors,
  UseFormTrigger,
} from "react-hook-form";
import React, { useContext, useMemo } from "react";
import styled from "@emotion/styled";
import { FormContextLevel, Inputs, StaffingServices } from "../../../../types";
import { BookingContext } from "../bookingProvider";

const Label = styled.label`
  font-weight: 500;
  font-size: 0.875rem;
  line-height: 1.25rem;
  margin-bottom: 0.5rem;
`;

interface Props {
  id: keyof Inputs;
  control: Control<Inputs, any>;
  errors: FieldErrors<Inputs>;
  trigger: UseFormTrigger<Inputs>;
  showStaffingServices: boolean;
  setShowStaffingServices: any;
  formContext: FormContextLevel;
}

const LOCKED_STAFFING_ROOM_IDS = new Set([103, 230]);

function normalizeRoomName(name?: unknown) {
  return typeof name === "string" ? name.trim().toLowerCase() : "";
}

export function roomRequiresLockedStaffing(room?: {
  roomId?: unknown;
  name?: unknown;
}) {
  if (!room) {
    return false;
  }

  const normalizedRoomId = Number(room.roomId);
  const normalizedName = normalizeRoomName(room.name);

  return (
    LOCKED_STAFFING_ROOM_IDS.has(normalizedRoomId) ||
    normalizedName === "garage" ||
    normalizedName === "audio lab"
  );
}

export function selectionRequiresLockedStaffing(
  selectedRooms: Array<{ roomId?: unknown; name?: unknown }>,
) {
  return selectedRooms.some((room) => roomRequiresLockedStaffing(room));
}

export default function BookingFormStaffingServices(props: Props) {
  const {
    id,
    control,
    errors,
    trigger,
    showStaffingServices,
    setShowStaffingServices,
    formContext: _formContext,
  } = props;
  const { selectedRooms } = useContext(BookingContext);
  const roomIds = selectedRooms.map((room) => room.roomId);
  const showStaffing = selectedRooms.some(
    (room) => room.staffingServices && room.staffingServices.length > 0,
  );
  const requiresLockedStaffing = useMemo(
    () => selectionRequiresLockedStaffing(selectedRooms),
    [selectedRooms],
  );
  const hasGarageSelected = useMemo(
    () =>
      selectedRooms.some(
        (room) => Number(room.roomId) === 103 || normalizeRoomName(room.name) === "garage",
      ),
    [selectedRooms],
  );
  const hasAudioLabSelected = useMemo(
    () =>
      selectedRooms.some(
        (room) =>
          Number(room.roomId) === 230 || normalizeRoomName(room.name) === "audio lab",
      ),
    [selectedRooms],
  );

  // Previously limited for walk-in/modification; restriction removed so full options show in all contexts

  const { staffingSections, staffingServices } = useMemo(() => {
    let sections: { name: string; indexes: number[] }[] = [];
    const services: StaffingServices[] = [];

    // Check for specific room services
    selectedRooms.forEach((room) => {
      // Use room-specific staffing services if available
      if (room.staffingServices && room.staffingServices.length > 0) {
        room.staffingServices.forEach((serviceKey: any) => {
          if (serviceKey && !services.includes(serviceKey)) {
            services.push(serviceKey);
          }
        });
      }

      // Check for staffing sections
      if (room.staffingSections && room.staffingSections.length > 0) {
        sections = room.staffingSections;
      }
    });

    return { staffingSections: sections, staffingServices: services };
  }, [roomIds, selectedRooms, showStaffing]);

  const isStaffingVisible = showStaffingServices || requiresLockedStaffing;

  const getValidationMessage = (value?: string) => {
    if (!isStaffingVisible) {
      return true;
    }

    const selectedServices = value?.split(",").filter(Boolean) || [];
    if (staffingSections.length === 0) {
      return selectedServices.length > 0 || "Staffing selection is required";
    }

    const allSectionsSelected = staffingSections.every((section) =>
      section.indexes.some((serviceIndex) => {
        const service = staffingServices[serviceIndex];
        return service ? selectedServices.includes(service) : false;
      }),
    );

    return (
      allSectionsSelected ||
      "Select one staffing option for each required section"
    );
  };

  const toggle = (
    <Controller
      name={id}
      control={control}
      render={({ field }) => (
        <FormControlLabel
          label={showStaffingServices ? "Yes" : "No"}
          control={
            <Switch
              checked={showStaffingServices}
              onChange={(e) => {
                setShowStaffingServices(e.target.checked);
                if (!e.target.checked) {
                  // de-select boxes if switch says "no staffing services"
                  field.onChange("");
                }

                trigger(id);
              }}
              onBlur={() => trigger(id)}
            />
          }
        />
      )}
    ></Controller>
  );

  // If staffing is disabled at the schema level, hide the entire control
  if (!showStaffing) {
    return null;
  }

  return (
    <div style={{ marginBottom: 8 }}>
      <Label htmlFor={id}>{requiresLockedStaffing ? "Staffing" : "Staffing?"}</Label>
      {requiresLockedStaffing ? (
        <>
          <p style={{ fontSize: "0.75rem" }}>
            Please indicate the level of support needed.
          </p>
          {hasAudioLabSelected && (
            <p style={{ fontSize: "0.75rem" }}>
              Audio Lab 230 staffing is required. See Staffing Type Definitions
              and the SAI Studio Audio Interface Playback Guide for the Plug &
              Play options. The video projection system is only available with
              an Audio Tech.
            </p>
          )}
          {hasGarageSelected && (
            <p style={{ fontSize: "0.75rem" }}>
              Garage 103 staffing is required. See Staffing Type Definitions
              and the Plug & Play Garage Guide for the available Plug & Play
              options.
            </p>
          )}
        </>
      ) : (
        <p style={{ fontSize: "0.75rem" }}>
          Request audio technicians, lighting technicians, and technical
          support.
        </p>
      )}
      {!requiresLockedStaffing && toggle}
      {isStaffingVisible && (
        <Controller
          name={id}
          control={control}
          rules={{ validate: getValidationMessage }}
          render={({ field, fieldState }) => (
            <div>
              {staffingSections.length > 0 ? (
                // Render sectioned staffing services with radio buttons for each service
                <div>
                  {staffingSections.map((section, sectionIndex) => {
                    const selectedServices = field.value?.split(",") || [];

                    return (
                      <div key={sectionIndex} style={{ marginBottom: 24 }}>
                        <FormLabel
                          component="legend"
                          sx={{
                            fontSize: "0.875rem",
                            fontWeight: 500,
                            marginBottom: 1,
                            display: "block",
                          }}
                        >
                          {section.name}:
                        </FormLabel>
                        <FormControl component="fieldset" error={fieldState.invalid}>
                          <RadioGroup
                            value={
                              selectedServices.find((service) =>
                                section.indexes.some(
                                  (index) =>
                                    staffingServices[index] === service,
                                ),
                              ) || ""
                            }
                            onChange={(e) => {
                              // Remove any previously selected services from this section
                              const otherServices = selectedServices.filter(
                                (service) =>
                                  !section.indexes.some(
                                    (index) =>
                                      staffingServices[index] === service,
                                  ),
                              );
                              // Add the newly selected service
                              const newServices = e.target.value
                                ? [...otherServices, e.target.value]
                                : otherServices;
                              field.onChange(newServices.join(","));
                              trigger(id);
                            }}
                            onBlur={() => trigger(id)}
                          >
                            {section.indexes.map((serviceIndex) => {
                              const service = staffingServices[serviceIndex];
                              return service ? (
                                <FormControlLabel
                                  key={serviceIndex}
                                  value={service}
                                  control={<Radio size="small" />}
                                  label={service}
                                  sx={{
                                    display: "block",
                                    fontSize: "0.75rem",
                                    marginBottom: 0.5,
                                  }}
                                />
                              ) : null;
                            })}
                          </RadioGroup>
                        </FormControl>
                      </div>
                    );
                  })}
                </div>
              ) : (
                // Render radio buttons for non-sectioned services (single select for staffing)
                <FormControl component="fieldset">
                  <RadioGroup
                    value={field.value || ""}
                    onChange={(e) => {
                      field.onChange(e.target.value);
                      trigger(id);
                    }}
                    onBlur={() => trigger(id)}
                  >
                    {staffingServices.map((service) => (
                      <FormControlLabel
                        key={service}
                        value={service}
                        control={<Radio size="small" />}
                        label={service}
                        sx={{
                          display: "block",
                          fontSize: "0.75rem",
                          marginBottom: 0.5,
                        }}
                      />
                    ))}
                  </RadioGroup>
                  <FormHelperText>
                    {fieldState.error?.message || errors[id]?.message?.toString()}
                  </FormHelperText>
                </FormControl>
              )}
            </div>
          )}
        ></Controller>
      )}
    </div>
  );
}
