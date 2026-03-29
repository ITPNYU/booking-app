import { describe, expect, it } from "vitest";
import { generateDefaultSchema } from "@/components/src/client/routes/components/SchemaProvider";

describe("tenant schema permissionLabels defaults", () => {
  it("uses Media Commons labels for mc tenant", () => {
    const schema = generateDefaultSchema("mc");

    expect(schema.permissionLabels).toEqual({
      user: "User",
      worker: "PA",
      reviewer: "Liaison",
      services: "Services",
      admin: "Admin",
    });
  });

  it("uses ITP labels for itp tenant", () => {
    const schema = generateDefaultSchema("itp");

    expect(schema.permissionLabels).toEqual({
      user: "User",
      worker: "ER",
      reviewer: "1st Approver",
      services: "Services",
      admin: "Admin",
    });
  });
});
