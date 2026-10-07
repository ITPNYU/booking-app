import {
  BookingContext,
  BookingProvider,
} from "@/components/src/client/routes/booking/bookingProvider";
import { DatabaseContext } from "@/components/src/client/routes/components/Provider";
import { Inputs, PagePermission, RoomSetting } from "@/components/src/types";
import { act, render, screen } from "@testing-library/react";
import { useContext } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  usePathname: () => "/mc/book/selectRoom",
}));

vi.mock(
  "@/components/src/client/routes/booking/hooks/fetchCalendarEvents",
  () => ({
    default: () => ({
      existingCalendarEvents: [],
      reloadExistingCalendarEvents: vi.fn(),
      fetchingStatus: "loaded",
    }),
  }),
);

const mockDatabaseContext = {
  bannedUsers: [],
  roomSettings: [],
  safetyTrainedUsers: [],
  userEmail: "test@nyu.edu",
  blackoutPeriods: [],
  reloadSafetyTrainedUsers: vi.fn(),
  pagePermission: PagePermission.BOOKING,
};

const roomA = { roomId: "101", name: "A", capacity: "10" } as RoomSetting;
const roomB = { roomId: "102", name: "B", capacity: "10" } as RoomSetting;

const answers = {
  title: "Demo",
  cateringByRoom: { "101": "yes", "102": "yes" },
  chartFieldForCateringByRoom: { "101": "AAA-11-11111-11111-11-11111" },
  roomSetupByRoom: { "102": "LAYOUT_1" },
} as unknown as Inputs;

let api: {
  setSelectedRooms: (rooms: RoomSetting[]) => void;
  setFormData: (data: Inputs) => void;
};

const Probe = () => {
  const { formData, setSelectedRooms, setFormData } =
    useContext(BookingContext);
  api = { setSelectedRooms, setFormData };
  return <pre data-testid="form-data">{JSON.stringify(formData ?? null)}</pre>;
};

const readFormData = () =>
  JSON.parse(screen.getByTestId("form-data").textContent ?? "null");

const renderProvider = () =>
  render(
    <DatabaseContext.Provider value={mockDatabaseContext as any}>
      <BookingProvider>
        <Probe />
      </BookingProvider>
    </DatabaseContext.Provider>,
  );

describe("BookingProvider - pruning service requests on room change", () => {
  it("drops per-room answers for a room the moment it is removed", () => {
    renderProvider();
    act(() => api.setSelectedRooms([roomA, roomB]));
    act(() => api.setFormData(answers));

    act(() => api.setSelectedRooms([roomA]));

    const pruned = readFormData();
    expect(pruned.title).toBe("Demo");
    expect(pruned.cateringByRoom).toEqual({ "101": "yes" });
    expect(pruned.chartFieldForCateringByRoom).toEqual({
      "101": "AAA-11-11111-11111-11-11111",
    });
    expect(pruned.roomSetupByRoom).toEqual({});
  });

  it("keeps answers for rooms that stay selected when a room is added", () => {
    renderProvider();
    act(() => api.setSelectedRooms([roomA]));
    act(() =>
      api.setFormData({ ...answers, cateringByRoom: { "101": "yes" } }),
    );

    act(() => api.setSelectedRooms([roomA, roomB]));

    expect(readFormData().cateringByRoom).toEqual({ "101": "yes" });
  });

  it("does not prune when rooms and answers are loaded together", () => {
    renderProvider();
    act(() => {
      api.setSelectedRooms([roomA]);
      api.setFormData(answers);
    });

    expect(readFormData().cateringByRoom).toEqual({
      "101": "yes",
      "102": "yes",
    });
  });

  it("clears a booking-level answer once no remaining room offers the service", () => {
    renderProvider();
    const cateringRoom = { ...roomA, services: ["catering"] } as RoomSetting;
    act(() => api.setSelectedRooms([cateringRoom, roomB]));
    act(() =>
      api.setFormData({
        title: "Demo",
        catering: "yes",
        chartFieldForCatering: "AAA-11-11111-11111-11-11111",
        hireSecurity: "",
      } as unknown as Inputs),
    );

    act(() => api.setSelectedRooms([roomB]));

    const pruned = readFormData();
    expect(pruned.title).toBe("Demo");
    expect(pruned.catering).toBe("");
    expect(pruned.chartFieldForCatering).toBe("");
  });

  it("keeps a booking-level answer while another room still offers the service", () => {
    renderProvider();
    const cateringA = { ...roomA, services: ["catering"] } as RoomSetting;
    const cateringB = { ...roomB, services: ["catering"] } as RoomSetting;
    act(() => api.setSelectedRooms([cateringA, cateringB]));
    act(() =>
      api.setFormData({ title: "Demo", catering: "yes" } as unknown as Inputs),
    );

    act(() => api.setSelectedRooms([cateringB]));

    expect(readFormData().catering).toBe("yes");
  });

  it("drops every per-room answer when the last room is removed", () => {
    renderProvider();
    act(() => api.setSelectedRooms([roomA, roomB]));
    act(() => api.setFormData(answers));

    act(() => api.setSelectedRooms([]));

    const pruned = readFormData();
    expect(pruned.title).toBe("Demo");
    expect(pruned.cateringByRoom).toEqual({});
    expect(pruned.chartFieldForCateringByRoom).toEqual({});
    expect(pruned.roomSetupByRoom).toEqual({});
  });
});
