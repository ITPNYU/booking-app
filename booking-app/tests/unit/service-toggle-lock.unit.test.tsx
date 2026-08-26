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
import { render, screen, waitFor } from "@testing-library/react";
import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { describe, expect, it } from "vitest";

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
}: {
  rooms: any[];
  onValues?: (get: () => Partial<Inputs>) => void;
}) {
  const {
    control,
    formState: { errors },
    trigger,
    watch,
    setValue,
    getValues,
  } = useForm<Inputs>({ mode: "onBlur" });
  const [showStaffingServices, setShowStaffingServices] = useState(false);
  onValues?.(() => getValues());
  return (
    <ThemeProvider theme={theme}>
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
        isLargeEvent={false}
      />
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
});

function StaffingHarness({ rooms }: { rooms: any[] }) {
  const { control, trigger, setValue } = useForm<Inputs>({ mode: "onBlur" });
  const [show, setShow] = useState(false);
  return (
    <ThemeProvider theme={theme}>
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

  it("leaves the switch user-controlled when toggle is omitted", () => {
    render(<StaffingHarness rooms={[staffingRoom()]} />);
    const toggle = screen.getAllByRole("checkbox")[0];
    expect(toggle).not.toBeChecked();
    expect(toggle).not.toBeDisabled();
  });
});
