import { deepPurple } from "@mui/material/colors";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { Timestamp } from "firebase/firestore";
import { beforeEach, describe, expect, it, vi } from "vitest";
import EquipmentCartDisplay from "../../components/src/client/routes/components/bookingTable/EquipmentCartDisplay";
import MoreInfoModal from "../../components/src/client/routes/components/bookingTable/MoreInfoModal";
import { DatabaseContext } from "../../components/src/client/routes/components/Provider";
import {
  SchemaProvider,
  generateDefaultSchema,
  type BookingDetailRole,
} from "../../components/src/client/routes/components/SchemaProvider";
import {
  BookingRow,
  PageContextLevel,
  PagePermission,
} from "../../components/src/types";

vi.mock(
  "../../components/src/client/routes/components/bookingTable/EquipmentCheckoutToggle",
  () => ({
    default: () => <div data-testid="equipment-checkout-toggle" />,
  }),
);

vi.mock(
  "../../components/src/client/routes/hooks/useSortBookingHistory",
  () => ({ default: () => null }),
);

vi.mock("next/navigation", () => ({
  useParams: () => ({ tenant: "mc" }),
}));

const mockTheme = createTheme({
  palette: {
    primary: { main: deepPurple.A700 },
    secondary: { main: deepPurple.A100, light: deepPurple[50] },
    custom: { border: "#e3e3e3" },
  },
} as any);

const mockFetch = vi.fn();
global.fetch = mockFetch;

const CART = "CK-2614";

const createBooking = (overrides: Partial<BookingRow> = {}): BookingRow =>
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
    status: "APPROVED" as any,
    equipmentCheckedOut: false,
    webcheckoutCartNumber: CART,
    ...overrides,
  }) as BookingRow;

type SchemaOptions = {
  showWebCheckout?: boolean;
  webCheckoutViewRoles?: BookingDetailRole[];
  webCheckoutEditRoles?: BookingDetailRole[];
};

const schemaWith = ({
  showWebCheckout = true,
  webCheckoutViewRoles,
  webCheckoutEditRoles,
}: SchemaOptions) => {
  const base = generateDefaultSchema("mc");
  return {
    ...base,
    detailsModal: {
      ...base.detailsModal,
      showWebCheckout,
      ...(webCheckoutViewRoles ? { webCheckoutViewRoles } : {}),
      ...(webCheckoutEditRoles ? { webCheckoutEditRoles } : {}),
    },
  };
};

const withProviders = (
  ui: React.ReactElement,
  permission: PagePermission,
  schema: SchemaOptions,
) => (
  <ThemeProvider theme={mockTheme}>
    <SchemaProvider value={schemaWith(schema)}>
      <DatabaseContext.Provider
        value={
          { pagePermission: permission, userEmail: "staff@nyu.edu" } as any
        }
      >
        {ui}
      </DatabaseContext.Provider>
    </SchemaProvider>
  </ThemeProvider>
);

const renderCell = ({
  permission,
  pageContext,
  booking = createBooking(),
  onCartClick = vi.fn(),
  ...schema
}: SchemaOptions & {
  permission: PagePermission;
  pageContext: PageContextLevel;
  booking?: BookingRow;
  onCartClick?: () => void;
}) =>
  render(
    withProviders(
      <EquipmentCartDisplay
        booking={booking}
        onCartClick={onCartClick}
        pageContext={pageContext}
      />,
      permission,
      schema,
    ),
  );

const cartShown = () => screen.queryByText(CART) !== null;

describe("EquipmentCartDisplay", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ cartNumber: CART, equipmentGroups: [] }),
    });
  });

  it.each([
    [PagePermission.PA, PageContextLevel.PA],
    [PagePermission.ADMIN, PageContextLevel.ADMIN],
    [PagePermission.SUPER_ADMIN, PageContextLevel.ADMIN],
  ])(
    "shows the cart number to %s on their page under the default roles",
    (permission, pageContext) => {
      renderCell({ permission, pageContext });
      expect(cartShown()).toBe(true);
      expect(
        screen.queryByTestId("equipment-checkout-toggle"),
      ).not.toBeInTheDocument();
    },
  );

  it.each([
    [PagePermission.LIAISON, PageContextLevel.LIAISON],
    [PagePermission.SERVICES, PageContextLevel.SERVICES],
  ])(
    "hides the cart number from %s under the default roles",
    (permission, pageContext) => {
      renderCell({ permission, pageContext });
      expect(cartShown()).toBe(false);
      expect(
        screen.getByTestId("equipment-checkout-toggle"),
      ).toBeInTheDocument();
    },
  );

  it("shows the cart number to Services when webCheckoutViewRoles includes SERVICES", () => {
    renderCell({
      permission: PagePermission.SERVICES,
      pageContext: PageContextLevel.SERVICES,
      webCheckoutViewRoles: ["SERVICES"],
      webCheckoutEditRoles: ["ADMIN"],
    });
    expect(cartShown()).toBe(true);
  });

  it("shows the cart number to a role that is only in webCheckoutEditRoles", () => {
    renderCell({
      permission: PagePermission.LIAISON,
      pageContext: PageContextLevel.LIAISON,
      webCheckoutViewRoles: ["ADMIN"],
      webCheckoutEditRoles: ["LIAISON"],
    });
    expect(cartShown()).toBe(true);
  });

  it("hides the cart number from PA when the roles exclude PA", () => {
    renderCell({
      permission: PagePermission.PA,
      pageContext: PageContextLevel.PA,
      webCheckoutViewRoles: ["ADMIN"],
      webCheckoutEditRoles: ["ADMIN"],
    });
    expect(cartShown()).toBe(false);
  });

  it("hides the cart number on a page context outside the roles even for an Admin", () => {
    // An Admin browsing the Services page sees what the Services page shows.
    renderCell({
      permission: PagePermission.ADMIN,
      pageContext: PageContextLevel.SERVICES,
    });
    expect(cartShown()).toBe(false);
  });

  it("hides the cart number from every role when showWebCheckout is off", () => {
    renderCell({
      permission: PagePermission.SUPER_ADMIN,
      pageContext: PageContextLevel.ADMIN,
      showWebCheckout: false,
    });
    expect(cartShown()).toBe(false);
    expect(screen.getByTestId("equipment-checkout-toggle")).toBeInTheDocument();
  });

  it("never shows the cart number on My Bookings", () => {
    renderCell({
      permission: PagePermission.ADMIN,
      pageContext: PageContextLevel.USER,
      webCheckoutViewRoles: ["PA", "LIAISON", "SERVICES", "ADMIN"],
    });
    expect(cartShown()).toBe(false);
  });

  it("shows the toggle when there is no cart number", () => {
    renderCell({
      permission: PagePermission.ADMIN,
      pageContext: PageContextLevel.ADMIN,
      booking: createBooking({ webcheckoutCartNumber: undefined }),
    });
    expect(screen.getByTestId("equipment-checkout-toggle")).toBeInTheDocument();
  });

  it("opens the booking when the cart number is clicked", () => {
    const onCartClick = vi.fn();
    renderCell({
      permission: PagePermission.PA,
      pageContext: PageContextLevel.PA,
      onCartClick,
    });
    fireEvent.click(screen.getByText(CART));
    expect(onCartClick).toHaveBeenCalledTimes(1);
  });

  describe("agrees with MoreInfoModal's WebCheckout section", () => {
    const staffPages: [PagePermission, PageContextLevel][] = [
      [PagePermission.PA, PageContextLevel.PA],
      [PagePermission.LIAISON, PageContextLevel.LIAISON],
      [PagePermission.SERVICES, PageContextLevel.SERVICES],
      [PagePermission.ADMIN, PageContextLevel.ADMIN],
      [PagePermission.SUPER_ADMIN, PageContextLevel.ADMIN],
    ];
    const configs: [string, SchemaOptions][] = [
      ["default roles", {}],
      [
        "Services view, Admin edit",
        { webCheckoutViewRoles: ["SERVICES"], webCheckoutEditRoles: ["ADMIN"] },
      ],
      [
        "Liaison edit only",
        { webCheckoutViewRoles: [], webCheckoutEditRoles: ["LIAISON"] },
      ],
      [
        "Admin only",
        { webCheckoutViewRoles: ["ADMIN"], webCheckoutEditRoles: ["ADMIN"] },
      ],
      ["WebCheckout off", { showWebCheckout: false }],
    ];

    it.each(configs)("%s", (_label, schema) => {
      for (const [permission, pageContext] of staffPages) {
        renderCell({ permission, pageContext, ...schema });
        const tableShowsCart = cartShown();
        cleanup();

        render(
          withProviders(
            <MoreInfoModal
              booking={createBooking()}
              closeModal={vi.fn()}
              pageContext={pageContext}
            />,
            permission,
            schema,
          ),
        );
        const modalShowsCart = screen.queryByText("WebCheckout") !== null;
        cleanup();

        expect({ permission, pageContext, tableShowsCart }).toEqual({
          permission,
          pageContext,
          tableShowsCart: modalShowsCart,
        });
      }
    });
  });
});
