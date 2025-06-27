import { describe, expect, it } from "vitest";

describe("Validation Utils", () => {
  describe("validateExpectedAttendance", () => {
    const validateExpectedAttendance = (value: string, maxCapacity: number) => {
      const attendance = parseInt(value);
      if (isNaN(attendance)) {
        return "Enter a number";
      }
      if (attendance <= 0) {
        return "Expected attendance must be >= 1";
      }
      return (
        attendance <= maxCapacity ||
        `Expected attendance exceeds maximum capacity of ${maxCapacity}`
      );
    };

    it("validates correct attendance number", () => {
      expect(validateExpectedAttendance("10", 20)).toBe(true);
    });

    it("rejects non-numeric input", () => {
      expect(validateExpectedAttendance("abc", 20)).toBe("Enter a number");
      expect(validateExpectedAttendance("", 20)).toBe("Enter a number");
      // parseInt('10a') returns 10, so this would be valid
      expect(validateExpectedAttendance("10a", 20)).toBe(true);
    });

    it("rejects zero or negative attendance", () => {
      expect(validateExpectedAttendance("0", 20)).toBe(
        "Expected attendance must be >= 1"
      );
      expect(validateExpectedAttendance("-5", 20)).toBe(
        "Expected attendance must be >= 1"
      );
    });

    it("rejects attendance exceeding capacity", () => {
      expect(validateExpectedAttendance("30", 20)).toBe(
        "Expected attendance exceeds maximum capacity of 20"
      );
      expect(validateExpectedAttendance("21", 20)).toBe(
        "Expected attendance exceeds maximum capacity of 20"
      );
    });
  });

  describe("validateRequired", () => {
    const validateRequired = (
      value: string,
      label: string,
      required: boolean
    ) => {
      if (!required) return true;
      const isNotEmpty = value?.trim().length > 0;
      return isNotEmpty || `${label} is required`;
    };

    it("validates required field with value", () => {
      expect(validateRequired("John", "First Name", true)).toBe(true);
      expect(validateRequired("test@example.com", "Email", true)).toBe(true);
    });

    it("rejects required field without value", () => {
      expect(validateRequired("", "First Name", true)).toBe(
        "First Name is required"
      );
      expect(validateRequired("   ", "Last Name", true)).toBe(
        "Last Name is required"
      );
    });

    it("allows optional field to be empty", () => {
      expect(validateRequired("", "Optional Field", false)).toBe(true);
      expect(validateRequired("   ", "Optional Field", false)).toBe(true);
    });

    it("validates optional field with value", () => {
      expect(validateRequired("Some value", "Optional Field", false)).toBe(
        true
      );
    });
  });

  describe("validateEmail", () => {
    const validateEmail = (value: string) => {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      return emailRegex.test(value) || "Please enter a valid email address";
    };

    it("validates correct email formats", () => {
      expect(validateEmail("test@example.com")).toBe(true);
      expect(validateEmail("user.name@domain.org")).toBe(true);
      expect(validateEmail("firstname+lastname@university.edu")).toBe(true);
      expect(validateEmail("test123@test-domain.co.uk")).toBe(true);
    });

    it("rejects invalid email formats", () => {
      expect(validateEmail("invalid")).toBe(
        "Please enter a valid email address"
      );
      expect(validateEmail("test@")).toBe("Please enter a valid email address");
      expect(validateEmail("@domain.com")).toBe(
        "Please enter a valid email address"
      );
      expect(validateEmail("test.domain.com")).toBe(
        "Please enter a valid email address"
      );
      expect(validateEmail("test@domain")).toBe(
        "Please enter a valid email address"
      );
      expect(validateEmail("test @domain.com")).toBe(
        "Please enter a valid email address"
      );
    });
  });

  describe("validateNetId", () => {
    const validateNetId = (value: string) => {
      const netIdRegex = /^[a-zA-Z0-9]+$/;
      if (!value || value.trim().length === 0) {
        return "NetID is required";
      }
      if (value.length < 3 || value.length > 8) {
        return "NetID must be between 3 and 8 characters";
      }
      if (!netIdRegex.test(value)) {
        return "NetID can only contain letters and numbers";
      }
      return true;
    };

    it("validates correct NetID formats", () => {
      expect(validateNetId("abc123")).toBe(true);
      expect(validateNetId("test123")).toBe(true);
      expect(validateNetId("user1")).toBe(true);
    });

    it("rejects empty NetID", () => {
      expect(validateNetId("")).toBe("NetID is required");
      expect(validateNetId("   ")).toBe("NetID is required");
    });

    it("rejects NetID that is too short or too long", () => {
      expect(validateNetId("ab")).toBe(
        "NetID must be between 3 and 8 characters"
      );
      expect(validateNetId("verylongnetid")).toBe(
        "NetID must be between 3 and 8 characters"
      );
    });

    it("rejects NetID with invalid characters", () => {
      expect(validateNetId("test-123")).toBe(
        "NetID can only contain letters and numbers"
      );
      expect(validateNetId("test_123")).toBe(
        "NetID can only contain letters and numbers"
      );
      expect(validateNetId("test@123")).toBe(
        "NetID can only contain letters and numbers"
      );
      expect(validateNetId("test 123")).toBe(
        "NetID can only contain letters and numbers"
      );
    });
  });
});
