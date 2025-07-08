import { formatOrigin } from "@/components/src/utils/formatters";
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
});
