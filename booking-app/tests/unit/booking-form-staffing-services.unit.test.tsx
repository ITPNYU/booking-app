import BookingFormStaffingServices from "@/components/src/client/routes/booking/components/BookingFormStaffingServices";
import { BookingContext } from "@/components/src/client/routes/booking/bookingProvider";
import { FormContextLevel, Inputs } from "@/components/src/types";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { describe, expect, it, vi } from "vitest";

type TestRoom = {
  roomId: number;
  name: string;
  staffingServices: string[];
  staffingSections?: Array<{ name: string; indexes: number[] }>;
};

function TestHarness({
  selectedRooms,
  initialShowStaffingServices = false,
}: {
  selectedRooms: TestRoom[];
  initialShowStaffingServices?: boolean;
}) {
  const {
    control,
    trigger,
    handleSubmit,
    formState: { errors },
  } = useForm<Inputs>({
    defaultValues: {
      staffingServices: "",
    } as Inputs,
    mode: "onSubmit",
  });
  const [showStaffingServices, setShowStaffingServices] = useState(
    initialShowStaffingServices,
  );

  return (
    <BookingContext.Provider
      value={{ selectedRooms } as any}
    >
      <form onSubmit={handleSubmit(vi.fn())}>
        <BookingFormStaffingServices
          id="staffingServices"
          control={control}
          errors={errors}
          trigger={trigger}
          showStaffingServices={showStaffingServices}
          setShowStaffingServices={setShowStaffingServices}
          formContext={FormContextLevel.FULL_FORM}
        />
        <button type="submit">Submit</button>
      </form>
    </BookingContext.Provider>
  );
}

describe("BookingFormStaffingServices", () => {
  it("shows Audio Lab staffing options immediately and hides the toggle", () => {
    render(
      <TestHarness
        selectedRooms={[
          {
            roomId: 230,
            name: "Audio Lab",
            staffingServices: [
              "No Technician / Plug & Play Audio Playback",
              "Audio Tech - General House Technician",
              "Audio Tech - Recording Engineer",
            ],
          },
        ]}
      />,
    );

    expect(screen.getByText("Staffing")).toBeInTheDocument();
    expect(screen.queryByText("Staffing?")).not.toBeInTheDocument();
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    expect(
      screen.getByText("No Technician / Plug & Play Audio Playback"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Audio Tech - Recording Engineer"),
    ).toBeInTheDocument();
  });

  it("requires one Garage staffing selection per section", async () => {
    const user = userEvent.setup();

    render(
      <TestHarness
        selectedRooms={[
          {
            roomId: 103,
            name: "Garage",
            staffingServices: [
              "No Technician / Plug & Play AV",
              "Audio Tech - General House Tech",
              "Audio Tech - A1 Live Sound Engineer",
              "No Technician / Plug & Play Lighting",
              "Lighting Tech - Support Your Own Board Op",
              "Lighting Tech - Busking",
              "Lighting Tech - Lighting Design",
            ],
            staffingSections: [
              { name: "Audio", indexes: [0, 1, 2] },
              { name: "Lighting", indexes: [3, 4, 5, 6] },
            ],
          },
        ]}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Submit" }));
    expect(
      screen.getByText("Select one staffing option for each required section"),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("radio", { name: "Audio Tech - General House Tech" }));
    await user.click(screen.getByRole("button", { name: "Submit" }));
    expect(
      screen.getByText("Select one staffing option for each required section"),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("radio", { name: "Lighting Tech - Busking" }));
    await user.click(screen.getByRole("button", { name: "Submit" }));

    await waitFor(() => {
      expect(
        screen.queryByText("Select one staffing option for each required section"),
      ).not.toBeInTheDocument();
    });
  });

  it("keeps the toggle for non-forced staffing rooms", () => {
    render(
      <TestHarness
        selectedRooms={[
          {
            roomId: 202,
            name: "Lecture Hall",
            staffingServices: ["Campus Media Services"],
          },
        ]}
      />,
    );

    expect(screen.getByText("Staffing?")).toBeInTheDocument();
    expect(screen.getByRole("checkbox")).toBeInTheDocument();
    expect(
      screen.queryByText("Campus Media Services"),
    ).not.toBeInTheDocument();
  });
});