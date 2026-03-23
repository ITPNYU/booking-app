import { formatOrigin, getSecondaryContactName } from "@/components/src/utils/formatters";
import { describe, expect, it } from "vitest";

describe("Formatters", () => {
  describe("formatOrigin", () => {
    it("should return 'User' for undefined input", () => {
      expect(formatOrigin(undefined)).toBe("User");
    });

    it("should return 'User' for null input", () => {
      expect(formatOrigin(null as any)).toBe("User");
    });

    it("should return 'User' for empty string", () => {
      expect(formatOrigin("")).toBe("User");
    });

    it("should format known origins correctly", () => {
      expect(formatOrigin("user")).toBe("User");
      expect(formatOrigin("vip")).toBe("VIP");
      expect(formatOrigin("walkIn")).toBe("Walk-In");
      expect(formatOrigin("walk-in")).toBe("Walk-In");
      expect(formatOrigin("pregame")).toBe("Pregame");
    });

    it("should return original value for unknown origins", () => {
      expect(formatOrigin("custom")).toBe("custom");
      expect(formatOrigin("unknown-origin")).toBe("unknown-origin");
      expect(formatOrigin("ADMIN")).toBe("ADMIN");
    });

    it("should handle case sensitivity correctly", () => {
      // These should NOT match the map and return as-is
      expect(formatOrigin("User")).toBe("User");
      expect(formatOrigin("VIP")).toBe("VIP");
      expect(formatOrigin("Walk-In")).toBe("Walk-In");
      expect(formatOrigin("WALK-IN")).toBe("WALK-IN");
    });

    it("should handle special characters in input", () => {
      expect(formatOrigin("test-123")).toBe("test-123");
      expect(formatOrigin("test_origin")).toBe("test_origin");
      expect(formatOrigin("test.origin")).toBe("test.origin");
    });
  });

  describe("getSecondaryContactName", () => {
    it("should return full name from new format fields", () => {
      expect(
        getSecondaryContactName({
          secondaryFirstName: "Jane",
          secondaryLastName: "Doe",
        }),
      ).toBe("Jane Doe");
    });

    it("should handle first name only in new format", () => {
      expect(
        getSecondaryContactName({ secondaryFirstName: "Jane", secondaryLastName: "" }),
      ).toBe("Jane");
    });

    it("should handle last name only in new format", () => {
      expect(
        getSecondaryContactName({ secondaryFirstName: "", secondaryLastName: "Doe" }),
      ).toBe("Doe");
    });

    it("should fall back to legacy secondaryName when new fields are absent", () => {
      expect(getSecondaryContactName({ secondaryName: "Jane Doe" })).toBe(
        "Jane Doe",
      );
    });

    it("should prefer new format over legacy secondaryName when both are present", () => {
      expect(
        getSecondaryContactName({
          secondaryFirstName: "Jane",
          secondaryLastName: "Doe",
          secondaryName: "Old Name",
        }),
      ).toBe("Jane Doe");
    });

    it("should return empty string when all fields are missing", () => {
      expect(getSecondaryContactName({})).toBe("");
    });

    it("should return empty string when all fields are empty strings", () => {
      expect(
        getSecondaryContactName({
          secondaryFirstName: "",
          secondaryLastName: "",
          secondaryName: "",
        }),
      ).toBe("");
    });

    it("should coerce non-string values to string", () => {
      expect(
        getSecondaryContactName({ secondaryFirstName: 42, secondaryLastName: 99 }),
      ).toBe("42 99");
    });
  });
});
