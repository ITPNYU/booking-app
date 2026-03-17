import { describe, it, expect } from "vitest";
import { validateSchema } from "@/scripts/validateTenantSchemas";
import type { SchemaContextType } from "@/components/src/client/routes/components/SchemaProvider";

function makeSchema(
  overrides: Partial<SchemaContextType> = {},
): SchemaContextType {
  return {
    tenant: "test",
    name: "Test Tenant",
    logo: "/logo.svg",
    nameForPolicy: "Test",
    policy: "<p>Policy</p>",
    programMapping: { Dept: ["PROG"] },
    roles: ["Student"],
    roleMapping: { Student: ["STUDENT"] },
    schoolMapping: { School: ["Dept"] },
    showNNumber: false,
    showSponsor: false,
    showSetup: false,
    showEquipment: false,
    showStaffing: false,
    showCatering: false,
    showHireSecurity: false,
    showBookingTypes: false,
    agreements: [{ id: "policy", html: "<p>Agree</p>" }],
    resources: [
      {
        capacity: 20,
        name: "Room A",
        roomId: 1,
        isEquipment: false,
        calendarId: "cal-1",
        isWalkIn: false,
        isWalkInCanBookTwo: false,
        services: [],
      },
    ],
    supportVIP: false,
    supportWalkIn: false,
    resourceName: "Room(s)",
    ccEmails: {
      approved: {
        development: "dev@test.com",
        staging: "stg@test.com",
        production: "prod@test.com",
      },
      canceled: {
        development: "dev@test.com",
        staging: "stg@test.com",
        production: "prod@test.com",
      },
    },
    emailMessages: {
      requestConfirmation: "msg",
      firstApprovalRequest: "msg",
      secondApprovalRequest: "msg",
      walkInConfirmation: "msg",
      vipConfirmation: "msg",
      checkoutConfirmation: "msg",
      checkinConfirmation: "msg",
      declined: "msg",
      canceled: "msg",
      lateCancel: "msg",
      noShow: "msg",
      closed: "msg",
      approvalNotice: "msg",
    },
    ...overrides,
  } as SchemaContextType;
}

describe("validateSchema", () => {
  it("passes for a fully configured schema", () => {
    const errors = validateSchema(makeSchema(), "production");
    expect(errors).toEqual([]);
  });

  it("reports error when name is empty", () => {
    const errors = validateSchema(makeSchema({ name: "" }), "production");
    expect(errors).toContainEqual(
      expect.objectContaining({ field: "name", severity: "error" }),
    );
  });

  it("reports error when roles are empty", () => {
    const errors = validateSchema(makeSchema({ roles: [] }), "production");
    expect(errors).toContainEqual(
      expect.objectContaining({ field: "roles", severity: "error" }),
    );
  });

  it("reports error when resources are empty", () => {
    const errors = validateSchema(
      makeSchema({ resources: [] }),
      "production",
    );
    expect(errors).toContainEqual(
      expect.objectContaining({ field: "resources", severity: "error" }),
    );
  });

  it("reports error when resource missing calendarId", () => {
    const errors = validateSchema(
      makeSchema({
        resources: [
          {
            capacity: 10,
            name: "Room B",
            roomId: 2,
            isEquipment: false,
            calendarId: "",
            isWalkIn: false,
            isWalkInCanBookTwo: false,
            services: [],
          },
        ],
      }),
      "production",
    );
    expect(errors).toContainEqual(
      expect.objectContaining({
        field: "resources[].calendarId",
        severity: "error",
      }),
    );
  });

  it("reports warning when ccEmails.approved is missing for env", () => {
    const errors = validateSchema(
      makeSchema({
        ccEmails: {
          approved: { development: "", staging: "", production: "" },
          canceled: {
            development: "d@t.com",
            staging: "s@t.com",
            production: "p@t.com",
          },
        },
      }),
      "production",
    );
    expect(errors).toContainEqual(
      expect.objectContaining({
        field: "ccEmails.approved",
        severity: "warning",
      }),
    );
  });

  it("reports warning when ccEmails is not configured at all", () => {
    const schema = makeSchema();
    delete (schema as any).ccEmails;
    const errors = validateSchema(schema, "production");
    const ccErrors = errors.filter((e) => e.field.startsWith("ccEmails"));
    expect(ccErrors.length).toBeGreaterThanOrEqual(2);
  });

  it("reports warning for empty email messages", () => {
    const errors = validateSchema(
      makeSchema({
        emailMessages: {
          requestConfirmation: "",
          firstApprovalRequest: "",
          secondApprovalRequest: "",
          walkInConfirmation: "",
          vipConfirmation: "",
          checkoutConfirmation: "",
          checkinConfirmation: "",
          declined: "",
          canceled: "",
          lateCancel: "",
          noShow: "",
          closed: "",
          approvalNotice: "",
        },
      }),
      "production",
    );
    expect(errors).toContainEqual(
      expect.objectContaining({
        field: "emailMessages",
        severity: "warning",
      }),
    );
  });

  it("checks correct env for ccEmails", () => {
    const schema = makeSchema({
      ccEmails: {
        approved: {
          development: "dev@t.com",
          staging: "",
          production: "prod@t.com",
        },
        canceled: {
          development: "dev@t.com",
          staging: "",
          production: "prod@t.com",
        },
      },
    });

    // staging should warn
    const stagingErrors = validateSchema(schema, "staging");
    const stagingCcErrors = stagingErrors.filter((e) =>
      e.field.startsWith("ccEmails"),
    );
    expect(stagingCcErrors.length).toBe(2);

    // production should pass
    const prodErrors = validateSchema(schema, "production");
    const prodCcErrors = prodErrors.filter((e) =>
      e.field.startsWith("ccEmails"),
    );
    expect(prodCcErrors.length).toBe(0);
  });
});
