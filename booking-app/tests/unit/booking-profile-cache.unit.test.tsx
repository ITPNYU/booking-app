import DetailsInput from "@/components/src/client/routes/booking/components/DetailsInput";
import UserRolePage from "@/components/src/client/routes/booking/formPages/UserRolePage";
import { BookingContext } from "@/components/src/client/routes/booking/bookingProvider";
import {
  clearBookingProfiles,
  readBookingProfile,
  writeBookingProfile,
} from "@/components/src/client/routes/booking/utils/bookingProfileCache";
import { DatabaseContext } from "@/components/src/client/routes/components/Provider";
import { SchemaProvider } from "@/components/src/client/routes/components/SchemaProvider";
import { FormContextLevel } from "@/components/src/types";
import { coerceTenantSchema } from "@/lib/tenant/coerceTenantSchema";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import { render, screen, waitFor } from "@testing-library/react";
import { useParams, useRouter } from "next/navigation";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: vi.fn(),
  useParams: vi.fn(),
}));

vi.mock(
  "@/components/src/client/routes/booking/hooks/useCheckAutoApproval",
  () => ({ default: vi.fn(() => ({ isAutoApproval: true })) }),
);

vi.mock(
  "@/components/src/client/routes/booking/hooks/useSubmitBooking",
  () => ({ default: vi.fn(() => vi.fn()) }),
);

vi.mock("@/components/src/client/routes/components/AuthProvider", () => ({
  useAuth: () => ({ user: { email: "abc123@nyu.edu" } }),
}));

const TENANT = "media-commons";
const EMAIL = "abc123@nyu.edu";

const theme = createTheme({
  palette: { custom: { border: "#e3e3e3", gray3: "#888888" } as any },
});

const schema = coerceTenantSchema(
  {
    tenantId: TENANT,
    tenant: { name: "Media Commons", logo: "", nameForPolicy: "MC" },
    policy: "",
    roles: ["Student", "Faculty", "Staff"],
    mappings: {
      program: { ITP: ["ITP"], "Film & TV": ["FTV"] },
      role: { Student: ["STUDENT"], Faculty: ["FACULTY"] },
      school: { Tisch: ["ITP", "Film & TV"] },
    },
    form: { showNNumber: true, showSponsor: true, showBookingType: false },
    attestations: [],
    resources: [],
    origins: { VIP: true, walkIn: true },
    resourceName: "Room",
  },
  TENANT,
);

const savedProfile = {
  firstName: "Cached",
  lastName: "Person",
  nNumber: "N87654321",
  phoneNumber: "212-555-0100",
  school: "Tisch",
  department: "ITP",
  role: "Faculty",
};

function renderDetails({
  formContext = FormContextLevel.FULL_FORM,
  userApiData,
  formData = null,
}: {
  formContext?: FormContextLevel;
  userApiData?: any;
  formData?: any;
} = {}) {
  return render(
    <ThemeProvider theme={theme}>
      <DatabaseContext.Provider
        value={
          {
            userEmail: EMAIL,
            netId: "abc123",
            settings: { bookingTypes: [] },
          } as any
        }
      >
        <SchemaProvider value={schema}>
          <BookingContext.Provider
            value={
              {
                role: "Faculty",
                department: "ITP",
                selectedRooms: [{ roomId: "room1", capacity: "20" }],
                formData,
                setFormData: vi.fn(),
                setIsDetailsValid: vi.fn(),
                checkedAgreements: {},
                setCheckedAgreements: vi.fn(),
              } as any
            }
          >
            <DetailsInput formContext={formContext} userApiData={userApiData} />
          </BookingContext.Provider>
        </SchemaProvider>
      </DatabaseContext.Provider>
    </ThemeProvider>,
  );
}

function renderRolePage({
  userApiStatus,
  userApiData,
}: {
  userApiStatus: "loading" | "loaded" | "error";
  userApiData?: any;
}) {
  const setRole = vi.fn();
  const setDepartment = vi.fn();
  const setFormData = vi.fn();
  render(
    <ThemeProvider theme={theme}>
      <DatabaseContext.Provider
        value={{ userEmail: EMAIL, userApiData, userApiStatus } as any}
      >
        <SchemaProvider value={schema}>
          <BookingContext.Provider
            value={
              {
                formData: undefined,
                role: undefined,
                department: undefined,
                setRole,
                setDepartment,
                setFormData,
              } as any
            }
          >
            <UserRolePage />
          </BookingContext.Provider>
        </SchemaProvider>
      </DatabaseContext.Provider>
    </ThemeProvider>,
  );
  return { setRole, setDepartment, setFormData };
}

beforeEach(() => {
  localStorage.clear();
  (useRouter as any).mockReturnValue({ push: vi.fn() });
  (useParams as any).mockReturnValue({ tenant: TENANT });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("bookingProfileCache", () => {
  it("stores only profile fields, per tenant and user", () => {
    writeBookingProfile(TENANT, EMAIL, {
      ...savedProfile,
      title: "My event",
      sponsorEmail: "prof@nyu.edu",
    });

    expect(readBookingProfile(TENANT, EMAIL)).toEqual(savedProfile);
    expect(readBookingProfile(TENANT, "someone@nyu.edu")).toEqual({});
    expect(readBookingProfile("itp", EMAIL)).toEqual({});
  });

  it("keeps earlier answers when a later booking leaves them blank", () => {
    writeBookingProfile(TENANT, EMAIL, savedProfile);
    writeBookingProfile(TENANT, EMAIL, { nNumber: "", phoneNumber: "999" });

    expect(readBookingProfile(TENANT, EMAIL)).toMatchObject({
      nNumber: "N87654321",
      phoneNumber: "999",
    });
  });

  it("clears every saved profile and leaves other storage alone", () => {
    writeBookingProfile(TENANT, EMAIL, savedProfile);
    writeBookingProfile("itp", "other@nyu.edu", savedProfile);
    localStorage.setItem("unrelated", "keep");

    clearBookingProfiles();

    expect(readBookingProfile(TENANT, EMAIL)).toEqual({});
    expect(readBookingProfile("itp", "other@nyu.edu")).toEqual({});
    expect(localStorage.getItem("unrelated")).toBe("keep");
  });

  it("forgets a profile after 90 days", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01"));
    writeBookingProfile(TENANT, EMAIL, savedProfile);
    vi.setSystemTime(new Date("2026-04-15"));

    expect(readBookingProfile(TENANT, EMAIL)).toEqual({});
  });
});

describe("DetailsInput profile fallback", () => {
  it("fills contact fields from the last booking when the API gave nothing", async () => {
    writeBookingProfile(TENANT, EMAIL, savedProfile);
    renderDetails();

    await waitFor(() =>
      expect(screen.getByDisplayValue("N87654321")).toBeInTheDocument(),
    );
    expect(screen.getByDisplayValue("Cached")).toBeInTheDocument();
    expect(screen.getByDisplayValue("212-555-0100")).toBeInTheDocument();
    expect(screen.getByDisplayValue("abc123")).toBeInTheDocument();
  });

  it("prefers identity API values over the cache", async () => {
    writeBookingProfile(TENANT, EMAIL, savedProfile);
    renderDetails({
      userApiData: {
        preferred_first_name: "Api",
        preferred_last_name: "User",
        university_id: "N11111111",
        netid: "abc123",
      },
    });

    await waitFor(() =>
      expect(screen.getByDisplayValue("212-555-0100")).toBeInTheDocument(),
    );
    expect(screen.getByDisplayValue("Api")).toBeInTheDocument();
    expect(screen.getByDisplayValue("N11111111")).toBeInTheDocument();
    expect(screen.queryByDisplayValue("Cached")).not.toBeInTheDocument();
  });

  it("does not refill fields already answered in this request", async () => {
    writeBookingProfile(TENANT, EMAIL, savedProfile);
    renderDetails({ formData: { phoneNumber: "" } });

    await waitFor(() =>
      expect(screen.getByDisplayValue("Cached")).toBeInTheDocument(),
    );
    expect(screen.queryByDisplayValue("212-555-0100")).not.toBeInTheDocument();
  });

  it("never fills a VIP request", async () => {
    writeBookingProfile(TENANT, EMAIL, savedProfile);
    renderDetails({ formContext: FormContextLevel.VIP });

    await new Promise((r) => setTimeout(r, 0));
    expect(screen.queryByDisplayValue("Cached")).not.toBeInTheDocument();
    expect(screen.queryByDisplayValue("212-555-0100")).not.toBeInTheDocument();
  });
});

describe("UserRolePage profile fallback", () => {
  it("restores the last affiliation when the identity API fails", async () => {
    writeBookingProfile(TENANT, EMAIL, savedProfile);
    const { setRole, setDepartment, setFormData } = renderRolePage({
      userApiStatus: "error",
    });

    await waitFor(() => expect(setRole).toHaveBeenCalledWith("Faculty"));
    expect(setDepartment).toHaveBeenCalledWith("ITP");
    await waitFor(() =>
      expect(setFormData).toHaveBeenCalledWith(
        expect.objectContaining({ school: "Tisch" }),
      ),
    );
  });

  it("waits for the identity API before using the cache", async () => {
    writeBookingProfile(TENANT, EMAIL, savedProfile);
    const { setRole, setDepartment } = renderRolePage({
      userApiStatus: "loading",
    });

    await new Promise((r) => setTimeout(r, 0));
    expect(setRole).not.toHaveBeenCalled();
    expect(setDepartment).not.toHaveBeenCalled();
  });

  it("prefers the saved department over Other for an unmapped department code", async () => {
    writeBookingProfile(TENANT, EMAIL, savedProfile);
    const { setDepartment, setFormData } = renderRolePage({
      userApiStatus: "loaded",
      userApiData: {
        affiliation_sub_type: "faculty",
        reporting_dept_code: "UNKNOWN",
      },
    });

    await waitFor(() => expect(setDepartment).toHaveBeenCalledWith("ITP"));
    expect(setDepartment).not.toHaveBeenCalledWith("Other");
    await waitFor(() =>
      expect(setFormData).toHaveBeenCalledWith(
        expect.objectContaining({ school: "Tisch" }),
      ),
    );
  });

  it("still uses Other for an unmapped department code with nothing saved", async () => {
    const { setDepartment } = renderRolePage({
      userApiStatus: "loaded",
      userApiData: {
        affiliation_sub_type: "faculty",
        reporting_dept_code: "UNKNOWN",
      },
    });

    await waitFor(() => expect(setDepartment).toHaveBeenCalledWith("Other"));
  });

  it("lets the identity API's role and department win", async () => {
    writeBookingProfile(TENANT, EMAIL, savedProfile);
    const { setRole, setDepartment } = renderRolePage({
      userApiStatus: "loaded",
      userApiData: {
        affiliation_sub_type: "student",
        reporting_dept_code: "FTV",
      },
    });

    await waitFor(() => expect(setRole).toHaveBeenCalledWith("Student"));
    expect(setRole).not.toHaveBeenCalledWith("Faculty");
    expect(setDepartment).toHaveBeenCalledWith("Film & TV");
    expect(setDepartment).not.toHaveBeenCalledWith("ITP");
  });
});
