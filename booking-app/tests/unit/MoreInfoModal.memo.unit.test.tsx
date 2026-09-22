import { deepPurple } from "@mui/material/colors";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Timestamp } from "firebase/firestore";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import MoreInfoModal from "../../components/src/client/routes/components/bookingTable/MoreInfoModal";
import { DatabaseContext } from "../../components/src/client/routes/components/Provider";
import {
  SchemaProvider,
  generateDefaultSchema,
} from "../../components/src/client/routes/components/SchemaProvider";
import {
  BookingRow,
  PageContextLevel,
  PagePermission,
} from "../../components/src/types";

global.alert = vi.fn();

const mockTheme = createTheme({
  palette: {
    primary: { main: deepPurple.A700 },
    secondary: { main: deepPurple.A100, light: deepPurple[50] },
    custom: { border: "#e3e3e3" },
  },
} as any);

vi.mock(
  "../../components/src/client/routes/hooks/useSortBookingHistory",
  () => ({
    default: () => (
      <tr key="test-row">
        <td>REQUESTED</td>
        <td>test@nyu.edu</td>
        <td>1/15/2024</td>
        <td>Initial request</td>
      </tr>
    ),
  }),
);

vi.mock("next/navigation", () => ({
  useParams: () => ({ tenant: "mc" }),
}));

const mockFetch = vi.fn();
global.fetch = mockFetch;

const createMockBooking = (overrides: Partial<BookingRow> = {}): BookingRow =>
  ({
    requestNumber: 12345,
    calendarEventId: "event-123",
    startDate: Timestamp.fromDate(new Date("2024-03-15T10:00:00")),
    endDate: Timestamp.fromDate(new Date("2024-03-15T12:00:00")),
    roomId: "202",
    netId: "jd1234",
    firstName: "John",
    lastName: "Doe",
    email: "test@nyu.edu",
    title: "Test Event",
    description: "Test description",
    status: "PENDING" as any,
    requestedAt: Timestamp.fromDate(new Date("2024-01-15T10:00:00")),
    checkedInAt: null,
    ...overrides,
  }) as BookingRow;

const createDatabaseContext = (permission: PagePermission) => ({
  pagePermission: permission,
  userEmail: "staff@nyu.edu",
  bannedUsers: [],
  roomSettings: [],
  safetyTrainedUsers: [],
  blackoutPeriods: [],
});

const renderModal = ({
  booking = createMockBooking(),
  permission,
  pageContext,
  showMemo = true,
  updateBooking,
}: {
  booking?: BookingRow;
  permission: PagePermission;
  pageContext?: PageContextLevel;
  showMemo?: boolean;
  updateBooking?: (b: BookingRow) => void;
}) => {
  const base = generateDefaultSchema("mc");
  const schema = { ...base, form: { ...base.form, showMemo } };
  return render(
    <ThemeProvider theme={mockTheme}>
      <SchemaProvider value={schema}>
        <DatabaseContext.Provider
          value={createDatabaseContext(permission) as any}
        >
          <MoreInfoModal
            booking={booking}
            closeModal={vi.fn()}
            pageContext={pageContext}
            updateBooking={updateBooking}
          />
        </DatabaseContext.Provider>
      </SchemaProvider>
    </ThemeProvider>,
  );
};

const memoSection = () => screen.queryByTestId("booking-memo-section");

describe("MoreInfoModal - Memo section", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockImplementation((url: RequestInfo | URL) => {
      if (typeof url === "string" && url.includes("/api/bookings/memo")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true }),
        });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("visibility", () => {
    it("shows for Admin permission in the Admin context", () => {
      renderModal({
        permission: PagePermission.ADMIN,
        pageContext: PageContextLevel.ADMIN,
      });
      expect(memoSection()).toBeInTheDocument();
      expect(screen.getByText("Memo")).toBeInTheDocument();
      expect(screen.getByLabelText("Edit memo")).toBeInTheDocument();
    });

    it("shows for Services permission in the Services context", () => {
      renderModal({
        permission: PagePermission.SERVICES,
        pageContext: PageContextLevel.SERVICES,
      });
      expect(memoSection()).toBeInTheDocument();
      expect(screen.getByLabelText("Edit memo")).toBeInTheDocument();
    });

    it("shows for Super Admin permission in the Admin context", () => {
      renderModal({
        permission: PagePermission.SUPER_ADMIN,
        pageContext: PageContextLevel.ADMIN,
      });
      expect(memoSection()).toBeInTheDocument();
    });

    it("hides when the tenant schema turns showMemo off", () => {
      renderModal({
        permission: PagePermission.ADMIN,
        pageContext: PageContextLevel.ADMIN,
        showMemo: false,
      });
      expect(memoSection()).not.toBeInTheDocument();
    });

    it.each([
      PageContextLevel.USER,
      PageContextLevel.PA,
      PageContextLevel.LIAISON,
    ])("hides in page context %s even for Admin permission", (ctx) => {
      renderModal({ permission: PagePermission.ADMIN, pageContext: ctx });
      expect(memoSection()).not.toBeInTheDocument();
    });

    it("hides when no page context is provided", () => {
      renderModal({ permission: PagePermission.ADMIN });
      expect(memoSection()).not.toBeInTheDocument();
    });

    it.each([
      PagePermission.BOOKING,
      PagePermission.PA,
      PagePermission.LIAISON,
    ])("hides for %s permission in the Admin context", (perm) => {
      renderModal({ permission: perm, pageContext: PageContextLevel.ADMIN });
      expect(memoSection()).not.toBeInTheDocument();
    });

    it("renders directly under the WebCheckout section", () => {
      renderModal({
        permission: PagePermission.ADMIN,
        pageContext: PageContextLevel.ADMIN,
      });
      const section = memoSection()!;
      const previous = section.previousElementSibling;
      expect(previous?.textContent).toContain("WebCheckout");
      const titles = Array.from(
        section.parentElement!.querySelectorAll("h6"),
      ).map((el) => el.textContent);
      expect(titles.indexOf("Memo")).toBe(titles.indexOf("WebCheckout") + 1);
      expect(titles.indexOf("History")).toBe(titles.indexOf("Memo") + 1);
    });
  });

  describe("display", () => {
    it("shows the saved memo", () => {
      renderModal({
        booking: createMockBooking({ memo: "WO-4567" }),
        permission: PagePermission.ADMIN,
        pageContext: PageContextLevel.ADMIN,
      });
      expect(screen.getByText("WO-4567")).toBeInTheDocument();
    });

    it("shows a placeholder when there is no memo", () => {
      renderModal({
        permission: PagePermission.ADMIN,
        pageContext: PageContextLevel.ADMIN,
      });
      expect(screen.getByText("No memo")).toBeInTheDocument();
    });
  });

  describe("editing", () => {
    it("saves the memo through the API and shows the new value", async () => {
      const updateBooking = vi.fn();
      const booking = createMockBooking();
      renderModal({
        booking,
        permission: PagePermission.SERVICES,
        pageContext: PageContextLevel.SERVICES,
        updateBooking,
      });

      fireEvent.click(screen.getByLabelText("Edit memo"));
      const input = screen.getByLabelText("Memo");
      fireEvent.change(input, { target: { value: "  WO-4567  " } });
      fireEvent.click(screen.getByLabelText("Save memo"));

      await waitFor(() => {
        expect(screen.getByText("WO-4567")).toBeInTheDocument();
      });

      const call = mockFetch.mock.calls.find(
        ([url]) => typeof url === "string" && url === "/api/bookings/memo",
      );
      expect(call).toBeDefined();
      const [, init] = call!;
      expect(init.method).toBe("PUT");
      expect(init.headers["x-tenant"]).toBe("mc");
      expect(JSON.parse(init.body)).toEqual({
        calendarEventId: "event-123",
        memo: "WO-4567",
      });
      expect(updateBooking).toHaveBeenCalledWith(
        expect.objectContaining({ memo: "WO-4567" }),
      );
      expect(screen.queryByLabelText("Save memo")).not.toBeInTheDocument();
      expect(screen.getByLabelText("Edit memo")).toBeInTheDocument();
    });

    it("cancel restores the saved memo without calling the API", () => {
      renderModal({
        booking: createMockBooking({ memo: "WO-1" }),
        permission: PagePermission.ADMIN,
        pageContext: PageContextLevel.ADMIN,
      });

      fireEvent.click(screen.getByLabelText("Edit memo"));
      fireEvent.change(screen.getByLabelText("Memo"), {
        target: { value: "changed" },
      });
      fireEvent.click(screen.getByLabelText("Cancel editing memo"));

      expect(screen.getByText("WO-1")).toBeInTheDocument();
      expect(screen.queryByLabelText("Memo")).not.toBeInTheDocument();
      expect(
        mockFetch.mock.calls.some(
          ([url]) =>
            typeof url === "string" && url.includes("/api/bookings/memo"),
        ),
      ).toBe(false);
    });

    it("shows the server error and stays in edit mode when saving fails", async () => {
      mockFetch.mockImplementation(() =>
        Promise.resolve({
          ok: false,
          json: () => Promise.resolve({ error: "Forbidden" }),
        }),
      );
      renderModal({
        permission: PagePermission.ADMIN,
        pageContext: PageContextLevel.ADMIN,
      });

      fireEvent.click(screen.getByLabelText("Edit memo"));
      fireEvent.change(screen.getByLabelText("Memo"), {
        target: { value: "WO-9" },
      });
      fireEvent.click(screen.getByLabelText("Save memo"));

      await waitFor(() => {
        expect(screen.getByText("Forbidden")).toBeInTheDocument();
      });
      expect(screen.getByLabelText("Memo")).toBeInTheDocument();
      expect(screen.getByLabelText("Save memo")).toBeInTheDocument();
    });
  });
});
