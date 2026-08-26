import BookingFormResourceServices from "@/components/src/client/routes/booking/components/BookingFormResourceServices";
import BookingFormStaffingServices from "@/components/src/client/routes/booking/components/BookingFormStaffingServices";
import { FormContextLevel, Inputs } from "@/components/src/types";
import {
  combineServiceToggles,
  getServiceToggle,
  lockedToggleValue,
  resolveSecurityToggle,
  resolveSharedServiceToggle,
} from "@/components/src/utils/resourceServicesUtils";
import { migrateResourceServices } from "@/lib/tenant/migrateResourceServices";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { describe, expect, it, vi } from "vitest";

const visibility = { isVIP: false, isWalkIn: false, isStandardUser: true };

describe("migrateResourceServices toggle", () => {
  it("passes through on / off / optional and drops unknown values", () => {
    const result = migrateResourceServices({
      services: {
        furnishings: { label: "Furniture", toggle: "off", descriptionHtml: "<p>x</p>" },
        equipment: { label: "Equipment", toggle: "ON", showDetailsField: true },
        catering: { label: "Catering", toggle: "optional", chartField: { required: true } },
        cleaning: { label: "Cleaning", toggle: "maybe", chartField: { required: true } },
        staffing: {
          label: "Staffing",
          toggle: "on",
          sections: {
            audio: {
              label: "Audio",
              options: [{ value: "A", label: "A" }],
              defaultValue: "A",
            },
          },
        },
      },
    });
    expect(result.furnishings?.toggle).toBe("off");
    expect(result.equipment?.toggle).toBe("on");
    expect(result.catering?.toggle).toBe("optional");
    expect(result.cleaning?.toggle).toBeUndefined();
    expect(result.staffing?.toggle).toBe("on");
  });

  it("accepts boolean flags saved as strings by the schema editor", () => {
    const result = migrateResourceServices({
      services: {
        equipment: {
          label: "Equipment",
          toggle: "on",
          showDetailsField: "true",
          chartField: { required: "true" },
        },
        catering: { label: "Catering", forceCleaning: "true", chartField: { required: true } },
      },
    });
    expect(result.equipment?.showDetailsField).toBe(true);
    expect(result.equipment?.chartField?.required).toBe(true);
    expect(result.catering?.forceCleaning).toBe(true);
  });

  it("keeps a description-only section as a switch when toggle is set", () => {
    const withToggle = migrateResourceServices({
      services: {
        furnishings: { label: "Furniture", descriptionHtml: "<p>included</p>", toggle: "off" },
      },
    });
    expect(withToggle.furnishings?.mode).toBeUndefined();

    const withoutToggle = migrateResourceServices({
      services: {
        furnishings: { label: "Furniture", descriptionHtml: "<p>included</p>" },
      },
    });
    expect(withoutToggle.furnishings?.mode).toBe("static");
  });
});

describe("service toggle helpers", () => {
  it("defaults to optional and maps locked values", () => {
    expect(getServiceToggle(undefined)).toBe("optional");
    expect(getServiceToggle({})).toBe("optional");
    expect(getServiceToggle({ toggle: "on" })).toBe("on");
    expect(lockedToggleValue("on")).toBe("yes");
    expect(lockedToggleValue("off")).toBe("no");
    expect(lockedToggleValue("optional")).toBeNull();
  });

  it("combines shared toggles: any on wins, off only when all off", () => {
    expect(combineServiceToggles([])).toBe("optional");
    expect(combineServiceToggles(["off", "on"])).toBe("on");
    expect(combineServiceToggles(["off", "off"])).toBe("off");
    expect(combineServiceToggles(["off", "optional"])).toBe("optional");
  });

  it("resolves shared toggles across selected rooms", () => {
    const rooms = [
      { resourceId: "202", services: { catering: { label: "C", toggle: "off", chartField: { required: true } } } },
      { resourceId: "1201", services: { catering: { label: "C", chartField: { required: true } } } },
    ];
    expect(resolveSharedServiceToggle(rooms, "catering", visibility)).toBe(
      "optional",
    );
    expect(
      resolveSharedServiceToggle(
        [rooms[0], { resourceId: "103", services: { catering: { label: "C", toggle: "on", chartField: { required: true } } } }],
        "catering",
        visibility,
      ),
    ).toBe("on");
  });

  it("ignores radio-mode security when resolving the security toggle", () => {
    const radioRoom = {
      resourceId: "1201",
      services: {
        security: {
          label: "S",
          mode: "radio" as const,
          toggle: "on" as const,
          options: [{ value: "a", label: "A" }],
        },
      },
    };
    const switchRoom = {
      resourceId: "233",
      services: { security: { label: "S", toggle: "off" as const, chartField: { required: true } } },
    };
    expect(resolveSecurityToggle([radioRoom], visibility)).toBe("optional");
    expect(resolveSecurityToggle([radioRoom, switchRoom], visibility)).toBe(
      "off",
    );
  });
});

const theme = createTheme();

function ServicesHarness({
  rooms,
  onValues,
  onValid,
  isLargeEvent = false,
}: {
  rooms: any[];
  onValues?: (get: () => Partial<Inputs>) => void;
  onValid?: (values: Partial<Inputs>) => void;
  isLargeEvent?: boolean;
}) {
  const {
    control,
    formState: { errors },
    trigger,
    watch,
    setValue,
    getValues,
    handleSubmit,
  } = useForm<Inputs>({ mode: "onBlur" });
  const [showStaffingServices, setShowStaffingServices] = useState(false);
  onValues?.(() => getValues());
  return (
    <ThemeProvider theme={theme}>
      <form onSubmit={handleSubmit((values) => onValid?.(values))}>
      <BookingFormResourceServices
        selectedRooms={rooms}
        control={control}
        errors={errors}
        trigger={trigger}
        watch={watch as any}
        setValue={setValue as any}
        isWalkIn={false}
        isVIP={false}
        formatFieldLabel={(l) => l}
        hireSecurityValue={watch("hireSecurity") ?? ""}
        showStaffingServices={showStaffingServices}
        setShowStaffingServices={setShowStaffingServices}
        formContext={FormContextLevel.FULL_FORM}
        cateringRequiresCleaning={false}
        isLargeEvent={isLargeEvent}
      />
      <button type="submit">Submit</button>
      </form>
    </ThemeProvider>
  );
}

describe("BookingFormResourceServices toggle locks", () => {
  it("renders a locked-off furnishings switch without fields and writes no", async () => {
    let getValues: () => Partial<Inputs> = () => ({});
    render(
      <ServicesHarness
        rooms={[
          {
            resourceId: "220",
            name: "Black Box",
            services: {
              furnishings: {
                label: "Additional Event Furniture",
                descriptionHtml: "<p>Included furniture</p>",
                toggle: "off",
                chartField: { required: true },
                showDetailsField: true,
              },
            },
          },
        ]}
        onValues={(get) => {
          getValues = get;
        }}
      />,
    );
    const toggle = screen.getByRole("checkbox");
    expect(toggle).toBeDisabled();
    expect(toggle).not.toBeChecked();
    expect(screen.getByText("Included furniture")).toBeInTheDocument();
    expect(screen.queryByLabelText(/Furniture request details/)).toBeNull();
    await waitFor(() => {
      expect(getValues().furnishingsByRoom).toEqual({ "220": "no" });
    });
  });

  it("renders a locked-on catering switch and writes yes", async () => {
    let getValues: () => Partial<Inputs> = () => ({});
    render(
      <ServicesHarness
        rooms={[
          {
            resourceId: "103",
            name: "Garage",
            services: {
              catering: {
                label: "Catering",
                toggle: "on",
                chartField: { required: true },
              },
            },
          },
        ]}
        onValues={(get) => {
          getValues = get;
        }}
      />,
    );
    const toggle = screen.getByRole("checkbox");
    expect(toggle).toBeDisabled();
    await waitFor(() => {
      expect(toggle).toBeChecked();
      expect(getValues().catering).toBe("yes");
    });
    expect(screen.getByText(/ChartField for Catering/)).toBeInTheDocument();
  });

  it("keeps security on for large events even when the schema locks it off", async () => {
    let getValues: () => Partial<Inputs> = () => ({});
    render(
      <ServicesHarness
        isLargeEvent
        rooms={[
          {
            resourceId: "233",
            services: {
              security: {
                label: "Campus Safety",
                toggle: "off",
                chartField: { required: true },
              },
            },
          },
        ]}
        onValues={(get) => {
          getValues = get;
        }}
      />,
    );
    // The "off" lock does not clear a large-event security value.
    await waitFor(() => expect(getValues().hireSecurity).not.toBe("no"));
    expect(screen.getByRole("checkbox")).toBeDisabled();
  });

  it("adds an equipment switch only when toggle is set", () => {
    const { unmount } = render(
      <ServicesHarness
        rooms={[
          {
            resourceId: "233",
            services: {
              equipment: { label: "Equipment", showDetailsField: true },
            },
          },
        ]}
      />,
    );
    expect(screen.queryByRole("checkbox")).toBeNull();
    expect(screen.getByLabelText(/Equipment request details/)).toBeInTheDocument();
    unmount();

    render(
      <ServicesHarness
        rooms={[
          {
            resourceId: "230",
            services: {
              equipment: { label: "Equipment", showDetailsField: true, toggle: "on" },
            },
          },
        ]}
      />,
    );
    const toggle = screen.getByRole("checkbox");
    expect(toggle).toBeDisabled();
    expect(toggle).toBeChecked();
    expect(screen.getByLabelText(/Equipment request details/)).toBeInTheDocument();
  });

  it("requires equipment details while a toggled equipment switch is on", async () => {
    const onValid = vi.fn();
    render(
      <ServicesHarness
        onValid={onValid}
        rooms={[
          {
            resourceId: "230",
            services: {
              equipment: { label: "Equipment", toggle: "on" },
            },
          },
        ]}
      />,
    );
    expect(screen.getByText("Equipment request details *")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Submit"));
    await waitFor(() =>
      expect(
        screen.getByText(/Please describe your equipment needs/),
      ).toBeInTheDocument(),
    );
    expect(onValid).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText(/Equipment request details/), {
      target: { value: "2x SM58" },
    });
    fireEvent.click(screen.getByText("Submit"));
    await waitFor(() => expect(onValid).toHaveBeenCalled());
    expect(onValid.mock.calls[0][0].equipmentServicesDetailsByRoom).toEqual({
      "230": "2x SM58",
    });
    expect(onValid.mock.calls[0][0].equipmentServicesDetails).toBe("2x SM58");
  });

  it("does not require details for a legacy equipment section without a toggle", async () => {
    const onValid = vi.fn();
    render(
      <ServicesHarness
        onValid={onValid}
        rooms={[
          {
            resourceId: "233",
            services: {
              equipment: { label: "Equipment", showDetailsField: true },
            },
          },
        ]}
      />,
    );
    fireEvent.click(screen.getByText("Submit"));
    await waitFor(() => expect(onValid).toHaveBeenCalled());
  });

  it("shows the equipment details field for a toggled section without showDetailsField", () => {
    render(
      <ServicesHarness
        rooms={[
          {
            resourceId: "230",
            services: {
              equipment: {
                label: "Equipment",
                descriptionHtml: "<p>SAI Studio gear</p>",
                mode: "static",
                toggle: "on",
              },
            },
          },
        ]}
      />,
    );
    expect(screen.getByRole("checkbox")).toBeChecked();
    expect(screen.getByLabelText(/Equipment request details/)).toBeInTheDocument();
  });
});

function StaffingHarness({
  rooms,
  onValid,
}: {
  rooms: any[];
  onValid?: (values: Partial<Inputs>) => void;
}) {
  const { control, trigger, setValue, handleSubmit } = useForm<Inputs>({
    mode: "onBlur",
  });
  const [show, setShow] = useState(false);
  return (
    <ThemeProvider theme={theme}>
      <form onSubmit={handleSubmit((values) => onValid?.(values))}>
        <BookingFormStaffingServices
          id="staffingServices"
          control={control}
          trigger={trigger}
          showStaffingServices={show}
          setShowStaffingServices={setShow}
          formContext={FormContextLevel.FULL_FORM}
          rooms={rooms}
          setValue={setValue as any}
        />
        <button type="submit">Submit</button>
      </form>
    </ThemeProvider>
  );
}

describe("BookingFormStaffingServices toggle lock", () => {
  const staffingRoom = (toggle?: string) => ({
    resourceId: "103",
    services: {
      staffing: {
        label: "Staffing",
        ...(toggle ? { toggle } : {}),
        sections: {
          audio: {
            label: "Audio",
            mode: "radio",
            defaultValue: "AUDIO_DIY",
            options: [
              { value: "AUDIO_DIY", label: "DIY" },
              { value: "AUDIO_TECH", label: "Tech" },
            ],
          },
        },
      },
    },
  });

  it("forces the switch on and shows the radios when toggle is on", async () => {
    render(<StaffingHarness rooms={[staffingRoom("on")]} />);
    const toggle = screen.getAllByRole("checkbox")[0];
    await waitFor(() => expect(toggle).toBeChecked());
    expect(toggle).toBeDisabled();
    expect(screen.getByLabelText("DIY")).toBeChecked();
  });

  it("blocks submit when a locked-on section has no default and nothing is selected", async () => {
    const onValid = vi.fn();
    render(
      <StaffingHarness
        onValid={onValid}
        rooms={[
          {
            resourceId: "230",
            services: {
              staffing: {
                label: "Staffing",
                toggle: "on",
                sections: {
                  default: {
                    label: "Audio",
                    mode: "radio",
                    options: [
                      { value: "AUDIO_DIY", label: "DIY" },
                      { value: "AUDIO_TECH", label: "Tech" },
                    ],
                  },
                },
              },
            },
          },
        ]}
      />,
    );
    await waitFor(() =>
      expect(screen.getAllByRole("checkbox")[0]).toBeChecked(),
    );
    fireEvent.click(screen.getByText("Submit"));
    await waitFor(() =>
      expect(
        screen.getByText(/Please select an option for each staffing section/),
      ).toBeInTheDocument(),
    );
    expect(onValid).not.toHaveBeenCalled();

    fireEvent.click(screen.getByLabelText("Tech"));
    fireEvent.click(screen.getByText("Submit"));
    await waitFor(() => expect(onValid).toHaveBeenCalled());
    expect(onValid.mock.calls[0][0].staffingServices).toBe("AUDIO_TECH");
  });

  it("honors a staffing lock from a later room when rendered for the first room", async () => {
    render(
      <ServicesHarness
        rooms={[
          {
            resourceId: "103",
            services: {
              staffing: {
                label: "Staffing",
                sections: {
                  audio: {
                    label: "Audio",
                    mode: "radio",
                    defaultValue: "A",
                    options: [{ value: "A", label: "A" }],
                  },
                },
              },
            },
          },
          {
            resourceId: "230",
            services: {
              staffing: {
                label: "Staffing",
                toggle: "on",
                sections: {
                  audio: {
                    label: "Audio",
                    mode: "radio",
                    defaultValue: "B",
                    options: [{ value: "B", label: "B" }],
                  },
                },
              },
            },
          },
        ]}
      />,
    );
    const toggle = screen.getAllByRole("checkbox")[0];
    await waitFor(() => expect(toggle).toBeChecked());
    expect(toggle).toBeDisabled();
  });

  it("leaves the switch user-controlled when toggle is omitted", () => {
    render(<StaffingHarness rooms={[staffingRoom()]} />);
    const toggle = screen.getAllByRole("checkbox")[0];
    expect(toggle).not.toBeChecked();
    expect(toggle).not.toBeDisabled();
  });
});
