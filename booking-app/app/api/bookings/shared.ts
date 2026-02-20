import { DEFAULT_TENANT } from "@/components/src/constants/tenants";
import { TableNames } from "@/components/src/policy";
import { BookingStatusLabel, Department } from "@/components/src/types";
import { isMediaCommons } from "@/components/src/utils/tenantUtils";
import { serverGetDocumentById } from "@/lib/firebase/server/adminDb";
import { NextRequest } from "next/server";
import { format, toZonedTime } from "date-fns-tz";

// All times in the booking app are in Eastern Time
export const TIMEZONE = "America/New_York";

/**
 * Checks if a school value represents "Other" selection.
 * School uses a string comparison (not an enum).
 */
const isOtherSchool = (val?: string): boolean => {
  if (!val) return false;
  return val.trim().toLowerCase() === "other";
};

/**
 * Extracts display values for department and school, handling "Other" selections.
 * When department or school is "Other", uses the manually entered values instead.
 */
export const getAffiliationDisplayValues = (data: {
  department?: string;
  otherDepartment?: string;
  school?: string;
  otherSchool?: string;
}) => {
  let departmentDisplay = data?.department || "";
  if (data?.department === Department.OTHER && data?.otherDepartment) {
    departmentDisplay = data.otherDepartment;
  }

  let schoolDisplay = data?.school || "";
  if (isOtherSchool(data?.school) && data?.otherSchool) {
    schoolDisplay = data.otherSchool;
  }

  return { departmentDisplay, schoolDisplay };
};

/**
 * Returns Firestore-compatible fields for storing "Other" display values.
 * Only includes fields if "Other" was selected and a manual value was provided.
 */
export const getOtherDisplayFields = (data: {
  department?: string;
  otherDepartment?: string;
  school?: string;
  otherSchool?: string;
}) => {
  return {
    ...(data?.department === Department.OTHER && data?.otherDepartment && {
      departmentDisplay: data.otherDepartment,
    }),
    ...(isOtherSchool(data?.school) && data?.otherSchool && {
      schoolDisplay: data.otherSchool,
    }),
  };
};

export const extractTenantFromRequest = (request: NextRequest): string => {
  const url = new URL(request.url);
  const pathParts = url.pathname.split("/");
  const tenantIndex = pathParts.findIndex(part => part === "api");
  const tenant = pathParts[tenantIndex - 1];
  return tenant && tenant !== "api" ? tenant : DEFAULT_TENANT;
};

export const getTenantFlags = (tenant: string) => {
  return {
    isITP: tenant === "itp",
    isMediaCommons: isMediaCommons(tenant),
    usesXState: true,
  };
};

export const getTenantRooms = async (tenant?: string) => {
  try {
    const schema = await serverGetDocumentById(
      TableNames.TENANT_SCHEMA,
      tenant || DEFAULT_TENANT,
    );

    if (!schema || !schema.resources) {
      console.log("No schema or resources found for tenant:", tenant);
      return [];
    }

    return schema.resources.map((resource: any) => ({
      roomId: resource.roomId,
      name: resource.name,
      capacity: resource.capacity?.toString(),
      calendarId: resource.calendarId,
    }));
  } catch (error) {
    console.error("Error fetching tenant rooms:", error);
    return [];
  }
};

export const buildBookingContents = (
  data: any,
  selectedRoomIds: string[],
  startDateObj: Date,
  endDateObj: Date,
  status: BookingStatusLabel,
  requestNumber: number,
  origin?: string,
) => {
  // Convert to Eastern Time before formatting
  const startDateET = toZonedTime(startDateObj, TIMEZONE);
  const endDateET = toZonedTime(endDateObj, TIMEZONE);
  
  return {
    ...data,
    roomId: selectedRoomIds,
    startDate: format(startDateET, "M/d/yyyy"),
    startTime: format(startDateET, "h:mm a"),
    endDate: format(endDateET, "M/d/yyyy"),
    endTime: format(endDateET, "h:mm a"),
    status,
    requestNumber,
    origin,
  };
};
