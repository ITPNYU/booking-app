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
      const netIdRegex = /^[a-zA-Z]{2,3}[0-9]{1,6}$/;
      if (!value || value.trim().length === 0) {
        return "NetID is required";
      }
      if (!netIdRegex.test(value)) {
        return "NetID must be 2-3 letters followed by 1-6 numbers";
      }
      return true;
    };

    it("validates correct NetID formats", () => {
      expect(validateNetId("abc123")).toBe(true);
      expect(validateNetId("ab123")).toBe(true);
      expect(validateNetId("abc123456")).toBe(true);
    });

    it("rejects empty NetID", () => {
      expect(validateNetId("")).toBe("NetID is required");
      expect(validateNetId("   ")).toBe("NetID is required");
    });

    it("rejects NetID that doesn't match the pattern", () => {
      expect(validateNetId("a123")).toBe(
        "NetID must be 2-3 letters followed by 1-6 numbers"
      );
      expect(validateNetId("123")).toBe(
        "NetID must be 2-3 letters followed by 1-6 numbers"
      );
      expect(validateNetId("N12345678")).toBe(
        "NetID must be 2-3 letters followed by 1-6 numbers"
      );
      expect(validateNetId("ab")).toBe(
        "NetID must be 2-3 letters followed by 1-6 numbers"
      );
      expect(validateNetId("abcd123")).toBe(
        "NetID must be 2-3 letters followed by 1-6 numbers"
      );
      expect(validateNetId("abc1234567")).toBe(
        "NetID must be 2-3 letters followed by 1-6 numbers"
      );
    });

    it("rejects NetID with invalid characters", () => {
      expect(validateNetId("test-123")).toBe(
        "NetID must be 2-3 letters followed by 1-6 numbers"
      );
      expect(validateNetId("test_123")).toBe(
        "NetID must be 2-3 letters followed by 1-6 numbers"
      );
      expect(validateNetId("test@123")).toBe(
        "NetID must be 2-3 letters followed by 1-6 numbers"
      );
      expect(validateNetId("test 123")).toBe(
        "NetID must be 2-3 letters followed by 1-6 numbers"
      );
    });
  });
});
