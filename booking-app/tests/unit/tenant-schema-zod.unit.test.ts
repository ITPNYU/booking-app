import { describe, expect, it } from "vitest";
import {
  approvalFlowEditorStarter,
  defaultResource,
  generateDefaultSchema,
  tenantResourceSchema,
  tenantSchema,
} from "../../components/src/client/routes/components/schemaTypes";
import { formatSchemaIssues } from "../../lib/tenant/validateTenantSchema";

function issuesOf(value: unknown) {
  const result = tenantSchema.safeParse(value);
  if (!("error" in result)) return [];
  return formatSchemaIssues(result.error);
}

describe("tenant schema zod validation", () => {
  const valid = generateDefaultSchema("mc");

  it("rejects a wrong type with a field path", () => {
    const issues = issuesOf({ ...valid, supportPA: "yes" });
    expect(issues.some((issue) => issue.path === "supportPA")).toBe(true);
  });

  it("rejects a wrong enum with a field path", () => {
    const issues = issuesOf({
      ...valid,
      form: {
        ...valid.form,
        alerts: [{ ...valid.form.alerts[0], severity: "urgent" }],
      },
    });
    expect(
      issues.some((issue) => issue.path.startsWith("form.alerts[0].severity")),
    ).toBe(true);
  });

  it("rejects an empty resource id with a field path", () => {
    const issues = issuesOf({
      ...valid,
      resources: [{ ...defaultResource, resourceId: "" }],
    });
    expect(issues.some((issue) => issue.path === "resources[0].resourceId")).toBe(
      true,
    );
    expect(issues.some((issue) => /required/i.test(issue.message))).toBe(true);
  });

  it("rejects a duplicate resource id with a field path", () => {
    const room = { ...defaultResource, resourceId: "studio" };
    const issues = issuesOf({
      ...valid,
      resources: [room, { ...room }],
    });
    expect(issues.some((issue) => issue.path === "resources[1].resourceId")).toBe(
      true,
    );
    expect(issues.some((issue) => /already/i.test(issue.message))).toBe(true);
  });

  it("allows an empty resource id on the room default", () => {
    const parsed = tenantResourceSchema.safeParse({
      ...defaultResource,
      resourceId: "studio",
    });
    expect("error" in parsed).toBe(false);
    expect("error" in tenantSchema.safeParse(defaultResource)).toBe(true);
  });

  it("keeps unknown keys from failing validation", () => {
    const parsed = tenantSchema.safeParse({ ...valid, legacyFlag: true });
    expect("error" in parsed).toBe(false);
  });

  it("parses a document that omits approvalFlow", () => {
    const parsed = tenantSchema.safeParse(valid);
    expect("error" in parsed).toBe(false);
    expect(valid).not.toHaveProperty("approvalFlow");
    expect(generateDefaultSchema("mc")).not.toHaveProperty("approvalFlow");
    expect("error" in tenantSchema.safeParse({
      ...valid,
      approvalFlow: approvalFlowEditorStarter,
    })).toBe(false);
  });

  it("rejects an unknown approval event with a field path", () => {
    const issues = issuesOf({
      ...valid,
      approvalFlow: {
        version: 1,
        initial: "Requested",
        states: {
          Requested: { on: { explode: { target: "Approved" } } },
          Approved: {},
        },
      },
    });
    expect(issues.some((issue) => issue.path.includes("on"))).toBe(true);
  });

  it("rejects an unknown guard and effect with a field path", () => {
    const issues = issuesOf({
      ...valid,
      approvalFlow: {
        version: 1,
        initial: "Requested",
        states: {
          Requested: {
            on: { approve: { target: "Approved", guard: "always" } },
            entry: ["sendSms"],
          },
          Approved: {},
        },
      },
    });
    expect(issues.some((issue) => issue.path.endsWith("on.approve"))).toBe(true);
    expect(issues.some((issue) => issue.path.includes("entry"))).toBe(true);
  });

  it("rejects a dangling target and a missing initial", () => {
    const dangling = issuesOf({
      ...valid,
      approvalFlow: {
        version: 1,
        initial: "Requested",
        states: {
          Requested: { on: { approve: { target: "Missing" } } },
        },
      },
    });
    expect(
      dangling.some(
        (issue) =>
          issue.path.endsWith("target") && /Missing/.test(issue.message),
      ),
    ).toBe(true);

    const missingInitial = issuesOf({
      ...valid,
      approvalFlow: {
        version: 1,
        initial: "Nope",
        states: { Requested: {} },
      },
    });
    expect(
      missingInitial.some(
        (issue) => issue.path === "approvalFlow.initial" && /Nope/.test(issue.message),
      ),
    ).toBe(true);
  });
});
