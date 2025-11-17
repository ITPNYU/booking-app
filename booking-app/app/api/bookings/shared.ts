import { DEFAULT_TENANT } from "@/components/src/constants/tenants";
import { TableNames } from "@/components/src/policy";
import { BookingStatusLabel } from "@/components/src/types";
import { isMediaCommons } from "@/components/src/utils/tenantUtils";
import { serverGetDocumentById } from "@/lib/firebase/server/adminDb";
import { NextRequest } from "next/server";
import { format, toZonedTime } from "date-fns-tz";

// All times in the booking app are in Eastern Time
const TIMEZONE = "America/New_York";

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
    startDate: format(startDateET, "M/d/yyyy", { timeZone: TIMEZONE }),
    startTime: format(startDateET, "h:mm a", { timeZone: TIMEZONE }),
    endDate: format(endDateET, "M/d/yyyy", { timeZone: TIMEZONE }),
    endTime: format(endDateET, "h:mm a", { timeZone: TIMEZONE }),
    status,
    requestNumber,
    origin,
  };
};
