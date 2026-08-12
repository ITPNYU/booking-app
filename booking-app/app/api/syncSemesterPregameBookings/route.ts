import { toFirebaseTimestampFromString } from "@/components/src/client/utils/serverDate";
import { TENANTS } from "@/components/src/constants/tenants";
import { TableNames, getTenantCollectionName } from "@/components/src/policy";
import {
  AttendeeAffiliation,
  Booking,
  BookingOrigin,
  BookingStatusLabel,
} from "@/components/src/types";
import {
  serverGetDocumentById,
  serverGetNextSequentialId,
} from "@/lib/firebase/server/adminDb";
import admin from "@/lib/firebase/server/firebaseAdmin";
import { getCalendarClient } from "@/lib/googleClient";
import { getMcResourceServices } from "@/lib/tenant/mcResourceServices";
import { mcBookingMachine } from "@/lib/stateMachines/mcBookingMachine";
import { applyEnvironmentCalendarIds } from "@/lib/utils/calendarEnvironment";
import { Timestamp } from "firebase/firestore";
import { NextRequest, NextResponse } from "next/server";
import { createActor } from "xstate";
import { extractTenantFromRequest } from "../bookings/shared";

const db = admin.firestore();

// Helper function to check if we're in development environment
const isDevelopmentEnvironment = (): boolean => {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "";
  return (
    baseUrl.includes("localhost") ||
    baseUrl.includes("127.0.0.1") ||
    baseUrl.includes("dev") ||
    process.env.NODE_ENV === "development"
  );
};

const TEST_MODE_GUEST_EMAIL = "booking-app+pregame@itp.nyu.edu";
const DEV_FALLBACK_GUEST_EMAIL = "booking-app@itp.nyu.edu";

// Keep requester PII out of logs: only retain the domain, which is
// enough to spot override-vs-passthrough without leaking NetIDs.
const redactEmailForLogs = (email: string): string => {
  if (!email) return "(none)";
  const at = email.lastIndexOf("@");
  return at === -1 ? "(local)" : `(local)@${email.slice(at + 1)}`;
};

// Get the appropriate email for the environment.
// In testMode, always redirect to a dedicated +pregame alias so real
// requesters never receive calendar invites from a test run, regardless
// of which environment the code is executing in.
const resolveGuestEmail = (
  originalEmail: string,
  { testMode }: { testMode: boolean },
): string => {
  if (testMode) {
    console.log(
      `🧪 TEST MODE: Overriding email ${redactEmailForLogs(originalEmail)} → ${TEST_MODE_GUEST_EMAIL}`,
    );
    return TEST_MODE_GUEST_EMAIL;
  }
  if (isDevelopmentEnvironment()) {
    console.log(
      `🔧 DEV ENVIRONMENT: Overriding email ${redactEmailForLogs(originalEmail)} → ${DEV_FALLBACK_GUEST_EMAIL}`,
    );
    return DEV_FALLBACK_GUEST_EMAIL;
  }
  return originalEmail;
};

// Clean object by removing undefined values for Firestore compatibility
function cleanObjectForFirestore(obj: any): any {
  if (obj === null || obj === undefined) {
    return null;
  }

  if (typeof obj !== "object") {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj
      .map(item => cleanObjectForFirestore(item))
      .filter(item => item !== undefined);
  }

  const cleaned: any = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      cleaned[key] = cleanObjectForFirestore(value);
    }
  }

  return cleaned;
}

const parseEmails = (emailString: string): string[] => {
  // Match all email addresses that end with @nyu.edu
  const emailRegex = /[a-zA-Z0-9._%+-]+@nyu\.edu/g;
  const emails = emailString.match(emailRegex) || [];
  // Remove HTML tags and clean up emails
  const cleanEmails = emails.map(email => email.replace(/<[^>]*>/g, "").trim());
  return Array.from(new Set(cleanEmails)); // Remove duplicates
};
const findRoomIds = (title: string, description?: string): string => {
  // First try to extract from title (old format)
  const titleMatch = title.match(/^\d+(,\s*\d+)*/);
  if (titleMatch) {
    return titleMatch[0];
  }

  // Try to extract from description (new format)
  if (description) {
    const roomRegex = /•\s*Room\(s\):\s*([^\n•]+)/i;
    const roomMatch = description.match(roomRegex);
    if (roomMatch) {
      // Remove HTML tags and clean up the room IDs
      const roomIds = roomMatch[1].replace(/<[^>]*>/g, "").trim();
      return roomIds;
    }
  }

  return "";
};

const getRequesterEmails = (description: string): string[] => {
  // First try the old format
  const oldFormatRegex =
    /<h2[^>]*>Requester Details[^>]*>([^<]*)<h2[^>]*>Reservation Details/;
  const oldMatch = description.match(oldFormatRegex);

  if (oldMatch) {
    return parseEmails(oldMatch[1]);
  }

  // Try the new format - extract email from the Requester section
  const emailRegex = /•\s*Email:\s*([^\n•]+)/i;
  const emailMatch = description.match(emailRegex);

  if (emailMatch) {
    const email = emailMatch[1].replace(/<[^>]*>/g, "").trim();
    if (email && email !== "none" && email.includes("@")) {
      return [email];
    }
  }

  // Fallback: try to extract NetID and construct email
  const netIdRegex = /•\s*NetID:\s*([^\n•]+)/i;
  const netIdMatch = description.match(netIdRegex);

  if (netIdMatch) {
    const netId = netIdMatch[1].replace(/<[^>]*>/g, "").trim();
    if (netId && netId !== "none") {
      return [`${netId}@nyu.edu`];
    }
  }

  return [];
};

// Service cells in the pregame sheet are checkboxes today ("true") but may
// become descriptive values; treat anything except empty/none/false/no as a
// request so a GAS-side change to real values cannot silently drop services.
const isServiceValueRequested = (value: string): boolean => {
  if (!value) return false;
  const v = value.trim().toLowerCase();
  return v !== "" && v !== "none" && v !== "false" && v !== "no";
};

// GAS writes staffing as room-prefixed option labels, e.g.
// "(103) Lighting Tech - Busking, (230) DIY - plug-and-play". The booking form
// stores option *values* (e.g. LIGHTING_TECH_BUSKING) comma-joined, so map
// each entry back onto the room's staffing options. Rooms without a staffing
// config (legacy schema arrays, where value === label) keep the bare label.
// Entries whose room has a config but whose label matches no option keep the
// "(roomId)" prefix so dry-run validation can surface the drift.
const canonicalizeStaffingEntry = (entry: string): string => {
  const match = entry.match(/^\((\d+)\)\s*(.+)$/);
  if (!match) return entry.trim();
  const [, roomId, rawLabel] = match;
  const label = rawLabel.trim();
  const staffingConfig = getMcResourceServices(roomId)?.staffing;
  if (!staffingConfig) return label;

  const target = label.toLowerCase();
  const matchesOption = (opt: { value: string; label?: string }) => {
    const optValue = opt.value.toLowerCase();
    const optLabel = opt.label?.toLowerCase();
    return (
      optValue === target ||
      optLabel === target ||
      // The sheet's dropdowns drop the section prefix from option labels
      // ("Audio Tech - A1" is stored as "A1"), so also match on the segment
      // after the " - " separator.
      optLabel?.endsWith(` - ${target}`) === true
    );
  };

  for (const section of Object.values(staffingConfig.sections ?? {})) {
    const found =
      section.options?.find(matchesOption) ??
      section.services?.find(matchesOption);
    if (found) return found.value;
  }
  const fromFlat = staffingConfig.staffingOptions?.find(matchesOption);
  if (fromFlat) return fromFlat.value;

  return entry.trim();
};

const parseStaffingServices = (raw: string): string =>
  raw
    // Entries are ", "-joined; split only before a "(roomId)" prefix so
    // old-format values without prefixes stay a single passthrough entry.
    .split(/,\s*(?=\()/)
    .map(canonicalizeStaffingEntry)
    .filter(Boolean)
    .join(",");

// The pregame sheet stores attendee affiliation as free text; map it onto the
// AttendeeAffiliation enum values, keeping the raw value when nothing matches.
const normalizeAttendeeAffiliation = (value: string): string => {
  const v = value.toLowerCase();
  if (v.includes("non-nyu") || v.includes("non nyu")) {
    return AttendeeAffiliation.NON_NYU;
  }
  if (v.includes("all of the above") || v.includes("both") || v === "all") {
    return AttendeeAffiliation.BOTH;
  }
  if (v.includes("nyu")) {
    return AttendeeAffiliation.NYU;
  }
  return value;
};

const parseDescription = (
  description: string,
): Partial<Booking> & {
  additionalEmails: string[];
  servicesRequested: {
    staff?: boolean;
    equipment?: boolean;
    catering?: boolean;
    cleaning?: boolean;
    security?: boolean;
    setup?: boolean;
  };
} => {
  const bookingDetails: Partial<Booking> & {
    additionalEmails: string[];
    servicesRequested: {
      staff?: boolean;
      equipment?: boolean;
      catering?: boolean;
      cleaning?: boolean;
      security?: boolean;
      setup?: boolean;
    };
  } = {
    additionalEmails: [],
    servicesRequested: {
      setup: false,
      equipment: false,
      staff: false,
      catering: false,
      cleaning: false,
      security: false,
    },
  };

  // Helper function to extract field value from new format and remove HTML tags
  const extractFieldValue = (fieldName: string): string => {
    const regex = new RegExp(
      `•\\s*${fieldName}:\\s*([^\\n•]+?)(?:<br\\/?>|$)`,
      "i",
    );
    const match = description.match(regex);
    if (!match) return "";

    let value = match[1].trim();

    // Remove HTML tags from the value
    value = value.replace(/<[^>]*>/g, "").trim();

    // If the value contains only "none" (case insensitive), return "none"
    if (value.toLowerCase().replace(/\s+/g, "") === "none") {
      return "none";
    }

    // For cleaning field, convert "true" to boolean string representation
    if (fieldName === "Cleaning" && value.toLowerCase() === "true") {
      return "true";
    }

    return value;
  };

  // Parse Requester section
  const netId = extractFieldValue("NetID");
  if (netId) {
    bookingDetails.netId = netId;
    bookingDetails.email = `${netId}@nyu.edu`;
  }

  const nameMatch = extractFieldValue("Name");
  if (nameMatch) {
    const nameParts = nameMatch.split(" ");
    bookingDetails.firstName = nameParts[0] || "";
    bookingDetails.lastName = nameParts.slice(1).join(" ") || "";
  }

  const department = extractFieldValue("Department");
  if (department && department !== "none") {
    bookingDetails.department = department;
  }

  const email = extractFieldValue("Email");
  if (email && email !== "none" && email !== bookingDetails.email) {
    bookingDetails.email = email;
    // Extract netId from email if different
    if (email.includes("@nyu.edu")) {
      bookingDetails.netId = email.split("@")[0];
    }
  }

  const phone = extractFieldValue("Phone");
  if (phone && phone !== "none") {
    bookingDetails.phoneNumber = phone;
  }

  const secondaryContact = extractFieldValue("Secondary Contact Name");
  if (secondaryContact && secondaryContact !== "none") {
    const secondaryParts = secondaryContact.split(" ");
    bookingDetails.secondaryFirstName = secondaryParts[0] || "";
    bookingDetails.secondaryLastName = secondaryParts.slice(1).join(" ") || "";
    // Legacy combined field, still read by paths that predate the split fields
    bookingDetails.secondaryName = secondaryContact;
  }

  const secondaryEmail = extractFieldValue("Secondary Contact Email");
  if (
    secondaryEmail &&
    secondaryEmail !== "none" &&
    secondaryEmail.includes("@")
  ) {
    bookingDetails.secondaryEmail = secondaryEmail;
  }

  const sponsorName = extractFieldValue("Sponsor Name");
  if (sponsorName && sponsorName !== "none") {
    const sponsorParts = sponsorName.split(" ");
    bookingDetails.sponsorFirstName = sponsorParts[0] || "";
    bookingDetails.sponsorLastName = sponsorParts.slice(1).join(" ") || "";
  }

  const sponsorEmail = extractFieldValue("Sponsor Email");
  if (sponsorEmail && sponsorEmail !== "none") {
    bookingDetails.sponsorEmail = sponsorEmail;
  }

  // Parse Details section
  const title = extractFieldValue("Title");
  if (title) {
    bookingDetails.title = title;
  }

  const eventDescription = extractFieldValue("Description");
  if (eventDescription) {
    bookingDetails.description = eventDescription;
  }

  const bookingType = extractFieldValue("Booking Type");
  bookingDetails.bookingType =
    bookingType && bookingType !== "none" ? bookingType : "";

  const expectedAttendance = extractFieldValue("Expected Attendance");
  console.log("expectedAttendance", expectedAttendance);
  if (expectedAttendance && expectedAttendance !== "none") {
    // The sheet stores attendance buckets; map them to numeric strings so the
    // app's comparisons work (isLargeEvent = parseInt(...) >= 75).
    if (expectedAttendance.includes("<50")) {
      bookingDetails.expectedAttendance = "19";
    } else if (expectedAttendance.includes(">50")) {
      bookingDetails.expectedAttendance = "50";
    } else if (expectedAttendance.includes(">=75")) {
      bookingDetails.expectedAttendance = "75";
    } else if (expectedAttendance.includes("<75")) {
      bookingDetails.expectedAttendance = "74";
    } else {
      bookingDetails.expectedAttendance = expectedAttendance;
    }
  }

  const attendeeAffiliation = extractFieldValue("Attendee Affiliation");
  if (attendeeAffiliation && attendeeAffiliation !== "none") {
    bookingDetails.attendeeAffiliation =
      normalizeAttendeeAffiliation(attendeeAffiliation);
  }

  // Parse Services section - record all fields individually
  const roomSetup = extractFieldValue("Room Setup");
  const hasRoomSetup = isServiceValueRequested(roomSetup);
  bookingDetails.roomSetup = hasRoomSetup ? "yes" : "";
  // getMediaCommonsServices deliberately ignores roomSetup === "yes" and keys
  // the setup flag off setupDetails, so this must stay non-empty on request.
  bookingDetails.setupDetails = hasRoomSetup
    ? roomSetup.toLowerCase() === "true"
      ? "yes"
      : roomSetup
    : "";
  bookingDetails.servicesRequested.setup = hasRoomSetup;

  const equipment = extractFieldValue("Equipment");
  const hasEquipment = equipment && equipment.toLowerCase() !== "none";
  // If equipment value is just "Equipment", treat it as "Checkout Equipment"
  const equipmentValue = hasEquipment
    ? equipment.toLowerCase() === "equipment"
      ? "Checkout Equipment"
      : equipment
    : "";
  bookingDetails.equipmentServices = equipmentValue;
  bookingDetails.servicesRequested.equipment = hasEquipment;

  // Still maintain mediaServices for compatibility
  if (hasEquipment) {
    bookingDetails.mediaServices = equipmentValue;
  }

  const staffing = extractFieldValue("Staffing");
  const hasStaffing = Boolean(staffing) && staffing.toLowerCase() !== "none";
  bookingDetails.staffingServices = hasStaffing
    ? parseStaffingServices(staffing)
    : "";
  // Keep the room-prefixed original: staffingServices loses room attribution
  // once canonicalized, and the details line renders verbatim in the UI.
  bookingDetails.staffingServicesDetails = hasStaffing ? staffing : "";
  bookingDetails.servicesRequested.staff = hasStaffing;

  const catering = extractFieldValue("Catering");
  const hasCatering = isServiceValueRequested(catering);
  bookingDetails.catering = hasCatering ? "yes" : "";
  // cateringService is display-only; a literal checkbox "true" is noise.
  if (hasCatering && catering.toLowerCase() !== "true") {
    bookingDetails.cateringService = catering;
  }
  bookingDetails.servicesRequested.catering = hasCatering;

  const cleaning = extractFieldValue("Cleaning");
  // Every MC catering config sets forceCleaning, and the booking form
  // auto-enables cleaning with catering — mirror that coupling here.
  const hasCleaning = isServiceValueRequested(cleaning) || hasCatering;
  bookingDetails.cleaning = hasCleaning ? "yes" : "";
  // getMediaCommonsServices keys the cleaning flag off cleaningService, and
  // the form stores "yes"/"no" there.
  bookingDetails.cleaningService = hasCleaning ? "yes" : "";
  bookingDetails.servicesRequested.cleaning = hasCleaning;

  const security = extractFieldValue("Security");
  const hasSecurity = isServiceValueRequested(security);
  bookingDetails.hireSecurity = hasSecurity ? "yes" : "";
  bookingDetails.servicesRequested.security = hasSecurity;

  // Set origin to pregame
  bookingDetails.origin = BookingOrigin.PREGAME;

  return bookingDetails;
};
const isPregameEvent = (title: string, description): boolean => {
  // Pregame events must have "Origin: Pregame" in description
  const hasPregameOrigin =
    description &&
    typeof description === "string" &&
    description.includes("Origin: Pregame");
  return Boolean(hasPregameOrigin);
};

const findGuestEmails = (event: any, description: string): string[] => {
  const guestEmails = new Set<string>();
  const parsedDetails = parseDescription(description);

  // Add primary email if exists
  if (parsedDetails.email) {
    guestEmails.add(parsedDetails.email);
  }

  // Add additional emails if any
  if (parsedDetails.additionalEmails?.length > 0) {
    parsedDetails.additionalEmails.forEach(email => guestEmails.add(email));
  }

  // Add existing attendees that are not calendar resources
  if (event.attendees?.length > 0) {
    event.attendees.forEach((attendee: any) => {
      if (
        attendee.email &&
        !attendee.email.endsWith("@group.calendar.google.com")
      ) {
        guestEmails.add(attendee.email);
      }
    });
  }

  return Array.from(guestEmails);
};

// Validates a pregame booking that would be created. Returns a list of
// human-readable issue strings. Used by dry-run to surface suspicious rows
// (missing room, empty email, bad timestamps, etc.) so admins don't have
// to eyeball raw JSON.
const validateBooking = (
  booking: any,
  {
    rawEmail,
    testMode,
  }: { rawEmail: string; testMode: boolean },
): string[] => {
  const issues: string[] = [];

  // Room IDs must be a comma-separated list of digits. findRoomIds returns
  // "" on no match, and real Firestore rows have shown literal "000", which
  // breaks every downstream room lookup.
  if (!booking?.roomId) {
    issues.push("Missing room");
  } else if (!/^\d+(,\s*\d+)*$/.test(booking.roomId)) {
    issues.push(`Invalid roomId "${booking.roomId}"`);
  } else if (/^0+(,|$)/.test(booking.roomId)) {
    issues.push(`Suspicious roomId "${booking.roomId}"`);
  }

  // Email: validate against the *source* email (pre-override), since in
  // testMode the stored email is always the +pregame alias.
  const sourceEmail = testMode ? rawEmail : booking?.email;
  if (!sourceEmail) {
    issues.push("Missing email");
  } else if (!/@(nyu|itp\.nyu)\.edu$/i.test(sourceEmail)) {
    issues.push(`Non-NYU email "${sourceEmail}"`);
  }

  // Dates.
  const startSecs =
    booking?.startDate?.seconds ?? booking?.startDate?._seconds;
  const endSecs = booking?.endDate?.seconds ?? booking?.endDate?._seconds;
  if (typeof startSecs !== "number") issues.push("Missing startDate");
  if (typeof endSecs !== "number") issues.push("Missing endDate");
  if (typeof startSecs === "number" && typeof endSecs === "number") {
    if (endSecs <= startSecs) {
      issues.push("endDate ≤ startDate");
    } else {
      const durationHours = (endSecs - startSecs) / 3600;
      if (durationHours > 8) {
        issues.push(`Long duration: ${durationHours.toFixed(1)}h`);
      }
    }
  }

  if (!booking?.title) issues.push("Missing title");

  // The booking form forces security on for events with >= 75 attendees;
  // surface pregame rows where the sheet disagrees so admins can follow up.
  if (
    parseInt(booking?.expectedAttendance || "0") >= 75 &&
    !booking?.hireSecurity
  ) {
    issues.push("Large event (>=75) without security");
  }

  // canonicalizeStaffingEntry strips the "(roomId)" prefix on success and on
  // legacy rooms; a surviving prefix means the room has a staffing config but
  // the GAS label matched none of its options (label drift).
  if (
    typeof booking?.staffingServices === "string" &&
    /\(\d+\)/.test(booking.staffingServices)
  ) {
    issues.push(
      `Unmatched staffing option(s) "${booking.staffingServices}"`,
    );
  }

  return issues;
};

const createBookingWithDefaults = (partialBooking: Partial<Booking>): Booking =>
  // @ts-ignore
  ({
    title: "",
    description: "",
    email: "",
    firstName: "",
    lastName: "",
    secondaryName: "",
    secondaryFirstName: "",
    secondaryLastName: "",
    secondaryEmail: "",
    nNumber: "",
    netId: "",
    phoneNumber: "",
    department: "",
    otherDepartment: "",
    role: "",
    sponsorFirstName: "",
    sponsorLastName: "",
    sponsorEmail: "",
    bookingType: "",
    attendeeAffiliation: "",
    roomSetup: "",
    setupDetails: "",
    mediaServices: "",
    mediaServicesDetails: "",
    catering: "",
    expectedAttendance: "",
    cateringService: "",
    chartFieldForCatering: "",
    chartFieldForSecurity: "",
    chartFieldForRoomSetup: "",
    calendarEventId: "",
    roomId: "",
    requestNumber: 0,
    equipmentCheckedOut: false,
    startDate: null,
    endDate: null,
    requestedAt: undefined,
    // Individual service fields for pregame parsing
    equipmentServices: "",
    staffingServices: "",
    hireSecurity: "",
    cleaningService: "",

    ...partialBooking,
  });
export async function POST(request: NextRequest) {
  try {
    const calendar = await getCalendarClient();

    // Get dryRun / testMode parameters from query params or request body
    const { searchParams } = new URL(request.url);
    const body = await request.json().catch(() => ({}));
    const dryRun =
      searchParams.get("dryRun") === "true" || body.dryRun === true;
    const testMode =
      searchParams.get("testMode") === "true" || body.testMode === true;

    console.log("🔍 DRY RUN MODE:", dryRun);
    console.log("🧪 TEST MODE:", testMode);

    // Safety: testMode is intended for dev/staging validation only.
    // It reads from prod calendars and skips real calendar patches, so
    // accidentally invoking it against the production deployment would
    // bypass guards that keep real data clean. Refuse outright.
    if (testMode && process.env.NEXT_PUBLIC_BRANCH_NAME === "production") {
      return NextResponse.json(
        {
          error:
            "testMode is not allowed on the production deployment. Use a dev or staging environment.",
        },
        { status: 400 },
      );
    }

    // Additional safety: if the server is configured to write to the
    // production Firestore database (e.g. a local .env.local pointing at
    // booking-app-prod), refuse testMode so a local run can't plant test
    // records in the real mc-bookings collection.
    if (testMode && process.env.NEXT_PUBLIC_DATABASE_NAME === "booking-app-prod") {
      return NextResponse.json(
        {
          error:
            "testMode refused: NEXT_PUBLIC_DATABASE_NAME is booking-app-prod. Point it at a dev/staging database (e.g. (default) or booking-app-staging) before running testMode.",
        },
        { status: 400 },
      );
    }

    // Real imports (not dry-run, not testMode) are only meaningful on the
    // production deployment, because pregame events only land on prod
    // calendars. Allowing them elsewhere invites confusion (0-result runs)
    // and can process ad-hoc test events that happen to sit on dev
    // calendars with "Origin: Pregame" in the description.
    if (
      !dryRun &&
      !testMode &&
      process.env.NEXT_PUBLIC_BRANCH_NAME !== "production"
    ) {
      return NextResponse.json(
        {
          error:
            "Real pregame import is only allowed on the production deployment. Use testMode or dryRun on dev/staging.",
        },
        { status: 400 },
      );
    }

    // Get tenant from request
    const tenant = extractTenantFromRequest(request);

    // This API is only for Media Commons tenant
    if (tenant !== TENANTS.MC) {
      console.error(
        `❌ SYNC PREGAME BOOKINGS: Unsupported tenant "${tenant}". This API only supports Media Commons (${TENANTS.MC}) tenant.`,
      );
      return NextResponse.json(
        {
          error: `This API only supports Media Commons (${TENANTS.MC}) tenant. Current tenant: ${tenant}`,
        },
        { status: 400 },
      );
    }

    console.log("✅ Tenant validation passed: Media Commons");

    // Get resources from tenant schema instead of collection
    const schema = await serverGetDocumentById(
      TableNames.TENANT_SCHEMA,
      tenant,
    );

    // Pregame events live on prod calendars only (the Google Apps Script
    // that creates them writes to production). In testMode we intentionally
    // override the env-based selection so non-prod deployments can still
    // read real events for validation; otherwise we follow the normal
    // calendarIdDev/calendarIdProd resolution.
    const resourcesWithCorrectCalendarIds = schema?.resources
      ? testMode
        ? schema.resources.map((r: any) => ({
            ...r,
            calendarId: r.calendarIdProd || r.calendarId,
          }))
        : applyEnvironmentCalendarIds(schema.resources)
      : [];

    const resources = resourcesWithCorrectCalendarIds.map((resource: any) => ({
      id: String(resource.resourceId ?? resource.roomId),
      calendarId: resource.calendarId,
      roomId: String(resource.resourceId ?? resource.roomId),
    }));

    if (testMode) {
      console.log(
        "🧪 TEST MODE: using production calendar IDs",
        resources.map(r => ({ roomId: r.roomId, calendarId: r.calendarId })),
      );
    }

    let totalNewBookings = 0;
    let existingBookings = 0;
    let targetBookings = 0;

    // For dry-run: collect information about what would be processed
    const dryRunResults: any[] = [];

    // Get tenant-specific booking collection name once
    const bookingCollection = getTenantCollectionName(
      TableNames.BOOKING,
      TENANTS.MC,
    );

    const now = new Date();
    const oneMonthsAgo = new Date(now.getFullYear(), now.getMonth(), 1);
    const fifthMonthsLater = new Date(
      now.getFullYear(),
      now.getMonth() + 12,
      0,
    );
    const timeMin = oneMonthsAgo.toISOString();
    const timeMax = fifthMonthsLater.toISOString();

    let count = 0;
    for (const resource of resources) {
      count++;
      // if (count > 1) {
      //  break;
      // }
      console.log("calendarId", resource.calendarId);
      const { calendarId } = resource;
      try {
        let pageToken: string | undefined;

        do {
          const events = await calendar.events.list({
            calendarId,
            timeMin,
            timeMax,
            maxResults: 500,
            singleEvents: true,
            orderBy: "startTime",
            pageToken,
          });

          for (const event of events.data.items || []) {
            // Skip not pregame events
            console.log(event.summary);
            console.log(
              "Is it pregame event?",
              isPregameEvent(event.summary, event.description),
            );
            if (isPregameEvent(event.summary, event.description)) {
              const bookingRef = db
                .collection(bookingCollection)
                .where("calendarEventId", "==", event.id);
              const bookingSnapshot = await bookingRef.get();
              const description = event.description || "";
              const parsedDetails = parseDescription(description);
              const guestEmails = findGuestEmails(event, description);
              const roomIds = findRoomIds(event.summary, description);
              const startDate = toFirebaseTimestampFromString(
                event.start?.dateTime,
              ) as Timestamp;
              const title = event.summary;
              const sanitizedTitle = title.replace(/^\[.*?\]\s*/, ""); // `[PRE_APPROVED]` を削除

              const existingBookingSnapshot = await db
                .collection(bookingCollection)
                .where("title", "==", sanitizedTitle)
                .where("startDate", "==", startDate)
                .get();

              if (!existingBookingSnapshot.empty) {
                existingBookings++;
                console.log(
                  `A Booking with title "${title}" and startDate "${event.start?.dateTime}" already exists.`,
                );

                const calendarEventId = event.id;
                const rawEmail = guestEmails[0]
                  ? guestEmails[0].replace(/<[^>]*>/g, "").trim()
                  : "";
                const cleanEmail = resolveGuestEmail(rawEmail, { testMode });

                if (!dryRun && !testMode) {
                  // Add [PRE_APPROVED]
                  if (
                    !title.startsWith("[") &&
                    !title.includes(`[${BookingStatusLabel.PRE_APPROVED}]`)
                  ) {
                    const newTitle = `[${BookingStatusLabel.PRE_APPROVED}] ${title}`;
                    console.log(
                      `Renaming existing event title from "${title}" to "${newTitle}".`,
                    );

                    await calendar.events.patch({
                      calendarId,
                      eventId: event.id,
                      requestBody: {
                        summary: newTitle,
                      },
                    });
                  }
                } else if (testMode) {
                  console.log(
                    `🧪 TEST MODE: skipping calendar event rename for "${title}"`,
                  );
                }
                continue;
              }

              if (bookingSnapshot.empty && guestEmails) {
                targetBookings++;
                console.log("calendarEventId", event.id);
                console.log("title", event.summary);
                console.log("guestEmails[0]", guestEmails[0]);

                const calendarEventId = event.id;
                const rawEmail = guestEmails[0]
                  ? guestEmails[0].replace(/<[^>]*>/g, "").trim()
                  : "";
                const cleanEmail = resolveGuestEmail(rawEmail, { testMode });

                // Remove servicesRequested from parsedDetails (only needed in XState context)
                const {
                  servicesRequested: _,
                  ...parsedDetailsWithoutServices
                } = parsedDetails;

                // Only allocate a real sequential requestNumber for real
                // writes. Calling serverGetNextSequentialId during dry-run
                // would bump the tenant counter without a corresponding
                // booking doc, burning numbers every preview.
                const requestNumber = dryRun
                  ? 0
                  : await serverGetNextSequentialId("bookings", tenant);

                const newBooking = createBookingWithDefaults({
                  ...parsedDetailsWithoutServices,
                  title: sanitizedTitle,
                  email: cleanEmail,
                  startDate: toFirebaseTimestampFromString(
                    event.start?.dateTime,
                  ) as Timestamp,
                  endDate: toFirebaseTimestampFromString(
                    event.end?.dateTime,
                  ) as Timestamp,
                  calendarEventId: calendarEventId || "",
                  roomId: roomIds,
                  requestNumber,
                });

                if (dryRun) {
                  console.log("dryRun");
                  const issues = validateBooking(newBooking, {
                    rawEmail,
                    testMode,
                  });
                  dryRunResults.push({ ...newBooking, _issues: issues });
                  totalNewBookings++;
                } else {
                  console.log("newBooking", newBooking);

                  // Initialize Xstate for pregame booking
                  console.log("🎭 INITIALIZING XSTATE FOR PREGAME BOOKING", {
                    calendarEventId,
                    servicesRequested: parsedDetails.servicesRequested,
                    origin: BookingOrigin.PREGAME,
                  });

                  // Create XState actor for pregame booking
                  const bookingActor = createActor(mcBookingMachine, {
                    input: {
                      tenant,
                      formData: newBooking,
                      bookingCalendarInfo: {
                        startStr: event.start?.dateTime,
                        endStr: event.end?.dateTime,
                      },
                      isWalkIn: false,
                      calendarEventId: calendarEventId || "",
                      email: cleanEmail,
                      isVip: false,
                      servicesRequested: parsedDetails.servicesRequested,
                      origin: BookingOrigin.PREGAME,
                    },
                  });

                  // Start the actor to trigger initial state evaluation
                  bookingActor.start();

                  // For pregame bookings, immediately move to Pre-approved state
                  bookingActor.send({ type: "approve" });

                  const currentState = bookingActor.getSnapshot();

                  console.log(
                    `✅ PREGAME BOOKING XSTATE INITIALIZED: ${currentState.value}`,
                  );

                  // Clean context by removing undefined values for Firestore compatibility (deep clean)
                  const cleanContext = cleanObjectForFirestore(
                    currentState.context,
                  );

                  // Create XState data for persistence
                  const xstateData = {
                    machineId: "MC Booking Request",
                    lastTransition: new Date().toISOString(),
                    snapshot: {
                      status: currentState.status,
                      value: currentState.value,
                      historyValue: cleanObjectForFirestore(
                        currentState.historyValue || {},
                      ),
                      context: cleanContext,
                      children: cleanObjectForFirestore(
                        currentState.children || {},
                      ),
                    },
                  };

                  console.log("✅ XSTATE INITIALIZED FOR PREGAME:", {
                    calendarEventId,
                    initialState: currentState.value,
                    servicesRequested: parsedDetails.servicesRequested,
                    contextServicesRequested: cleanContext.servicesRequested,
                    xstateContextServicesRequested:
                      currentState.context.servicesRequested,
                  });

                  // Add [PRE_APPROVED] prefix if not already present
                  let newTitle = event.summary;
                  if (
                    !newTitle.startsWith("[") &&
                    !newTitle.includes(`[${BookingStatusLabel.PRE_APPROVED}]`)
                  ) {
                    newTitle = `[${BookingStatusLabel.PRE_APPROVED}] ${newTitle}`;
                  }

                  const bookingDocRef = await db
                    .collection(bookingCollection)
                    .add({
                      ...newBooking,
                      xstateData,
                      requestedAt: admin.firestore.FieldValue.serverTimestamp(),
                      firstApprovedAt:
                        admin.firestore.FieldValue.serverTimestamp(),
                    });

                  // Add all requesters as guests to the calendar event
                  if (event.id && !testMode) {
                    await calendar.events.patch({
                      calendarId,
                      eventId: event.id,
                      requestBody: {
                        summary: newTitle,
                      },
                    });
                  } else if (testMode) {
                    console.log(
                      `🧪 TEST MODE: skipping calendar event rename for new booking "${newTitle}"`,
                    );
                  }

                  console.log(
                    `New Booking created with ID: ${bookingDocRef.id}`,
                  );
                  totalNewBookings++;
                }
              } else if (bookingSnapshot.empty && !guestEmails) {
                console.log("No guest emails found");
              }
            }
          }
          pageToken = events.data.nextPageToken;
        } while (pageToken);
      } catch (error) {
        console.error(
          `Error processing calendar ${resource.calendarId}:`,
          error,
        );
      }
    }

    console.log("targetBookings", targetBookings);
    console.log("totalNewBookings", totalNewBookings);

    if (dryRun) {
      const issuesCount = dryRunResults.filter(
        r => Array.isArray(r._issues) && r._issues.length > 0,
      ).length;
      return NextResponse.json(
        {
          message: `DRY RUN${testMode ? " (TEST MODE)" : ""}: Found ${dryRunResults.length} target bookings to process.`,
          dryRun: true,
          testMode,
          summary: {
            totalEvents: dryRunResults.length,
            newBookings: targetBookings,
            existingBookings,
            issuesCount,
          },
          results: dryRunResults,
        },
        { status: 200 },
      );
    }
    return NextResponse.json(
      {
        message: `${testMode ? "TEST MODE: " : ""}${totalNewBookings} new bookings have been synchronized. ${existingBookings} existing bookings have been updated with multiple rooms.`,
        testMode,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("Error syncing calendars:", error);
    return NextResponse.json(
      { error: "An error occurred while syncing calendars." },
      { status: 500 },
    );
  }
}
