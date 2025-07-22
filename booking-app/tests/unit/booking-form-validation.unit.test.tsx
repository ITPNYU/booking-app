import { describe, expect, it } from "vitest";

describe("Booking Form Validation", () => {
  describe("Phone Number Validation", () => {
    const phoneRegex =
      /^\(?([2-9][0-8][0-9])\)?[-. ]?([2-9][0-9]{2})[-. ]?([0-9]{4})$/;

    const validatePhoneNumber = (value: string) => {
      return (
        phoneRegex.test(value) ||
        "Please enter a valid 10 digit telephone number."
      );
    };

    it("validates correct phone number formats", () => {
      expect(validatePhoneNumber("2125551234")).toBe(true);
      expect(validatePhoneNumber("(212) 555-1234")).toBe(true);
      expect(validatePhoneNumber("212-555-1234")).toBe(true);
      expect(validatePhoneNumber("212.555.1234")).toBe(true);
      expect(validatePhoneNumber("212 555 1234")).toBe(true);
      expect(validatePhoneNumber("(212)555-1234")).toBe(true);
    });

    it("rejects invalid phone number formats", () => {
      const errorMessage = "Please enter a valid 10 digit telephone number.";

      expect(validatePhoneNumber("123456789")).toBe(errorMessage); // Too short
      expect(validatePhoneNumber("12345678901")).toBe(errorMessage); // Too long
      expect(validatePhoneNumber("(111) 555-1234")).toBe(errorMessage); // Invalid area code
      expect(validatePhoneNumber("(212) 155-1234")).toBe(errorMessage); // Invalid exchange
      expect(validatePhoneNumber("abc-def-ghij")).toBe(errorMessage); // Non-numeric
      expect(validatePhoneNumber("")).toBe(errorMessage); // Empty
      expect(validatePhoneNumber("212-555-12345")).toBe(errorMessage); // Too many digits
    });
  });

  describe("NYU Email Validation", () => {
    const nyuEmailRegex = /^[A-Z0-9._%+-]+@nyu.edu$/i;

    const validateNYUEmail = (value: string) => {
      return nyuEmailRegex.test(value) || "Invalid email address";
    };

    it("validates correct NYU email formats", () => {
      expect(validateNYUEmail("test@nyu.edu")).toBe(true);
      expect(validateNYUEmail("Test.User@nyu.edu")).toBe(true);
      expect(validateNYUEmail("test123@nyu.edu")).toBe(true);
      expect(validateNYUEmail("test.user+tag@nyu.edu")).toBe(true);
      expect(validateNYUEmail("firstname.lastname@nyu.edu")).toBe(true);
    });

    it("rejects invalid NYU email formats", () => {
      const errorMessage = "Invalid email address";

      expect(validateNYUEmail("test@gmail.com")).toBe(errorMessage);
      expect(validateNYUEmail("test@nyu.com")).toBe(errorMessage);
      expect(validateNYUEmail("test@edu")).toBe(errorMessage);
      expect(validateNYUEmail("@nyu.edu")).toBe(errorMessage);
      expect(validateNYUEmail("test@")).toBe(errorMessage);
      expect(validateNYUEmail("test")).toBe(errorMessage);
      expect(validateNYUEmail("")).toBe(errorMessage);
      expect(validateNYUEmail("test@nyu.")).toBe(errorMessage);
    });
  });

  describe("N-Number Validation", () => {
    const nNumberRegex = /N[0-9]{8}$/;

    const validateNNumber = (value: string) => {
      return nNumberRegex.test(value) || "Invalid N-Number";
    };

    it("validates correct N-Number format", () => {
      expect(validateNNumber("N12345678")).toBe(true);
      expect(validateNNumber("N00000000")).toBe(true);
      expect(validateNNumber("N99999999")).toBe(true);
    });

    it("rejects invalid N-Number formats", () => {
      const errorMessage = "Invalid N-Number";

      expect(validateNNumber("n12345678")).toBe(errorMessage); // Lowercase n
      expect(validateNNumber("N1234567")).toBe(errorMessage); // Too short
      expect(validateNNumber("N123456789")).toBe(errorMessage); // Too long
      expect(validateNNumber("N1234567a")).toBe(errorMessage); // Non-numeric
      expect(validateNNumber("12345678")).toBe(errorMessage); // Missing N
      expect(validateNNumber("")).toBe(errorMessage); // Empty
      expect(validateNNumber("N-12345678")).toBe(errorMessage); // Contains dash
      expect(validateNNumber("N 12345678")).toBe(errorMessage); // Contains space
    });
  });

  describe("Net ID Validation", () => {
    const netIdRegex = /^[a-zA-Z]{2,3}[0-9]{1,6}$/;

    const validateNetId = (value: string) => {
      return netIdRegex.test(value) || "Invalid Net ID - must be 2-3 letters followed by 1-6 numbers";
    };

    it("validates correct Net ID formats", () => {
      expect(validateNetId("abc123")).toBe(true);
      expect(validateNetId("ab123")).toBe(true);
      expect(validateNetId("abc123456")).toBe(true);
      expect(validateNetId("ABC123")).toBe(true); // Case insensitive
    });

    it("rejects invalid Net ID formats", () => {
      const errorMessage = "Invalid Net ID - must be 2-3 letters followed by 1-6 numbers";

      expect(validateNetId("a123")).toBe(errorMessage); // Only one letter
      expect(validateNetId("123")).toBe(errorMessage); // Numbers only
      expect(validateNetId("N12345678")).toBe(errorMessage); // N-number format
      expect(validateNetId("ab")).toBe(errorMessage); // Just letters
      expect(validateNetId("abcd123")).toBe(errorMessage); // Too many letters
      expect(validateNetId("abc1234567")).toBe(errorMessage); // Too many numbers
      expect(validateNetId("ab-123")).toBe(errorMessage); // Contains dash
      expect(validateNetId("ab 123")).toBe(errorMessage); // Contains space
      expect(validateNetId("")).toBe(errorMessage); // Empty
      expect(validateNetId("abc@123")).toBe(errorMessage); // Contains special char
    });
  });

  describe("Sponsor Email Validation", () => {
    const validateSponsorEmail = (sponsorEmail: string, userEmail: string) => {
      if (sponsorEmail === userEmail) {
        return "Sponsor email cannot be your own email";
      }
      return true;
    };

    it("allows valid sponsor email different from user email", () => {
      expect(validateSponsorEmail("sponsor@nyu.edu", "student@nyu.edu")).toBe(
        true
      );
      expect(validateSponsorEmail("prof@nyu.edu", "student@nyu.edu")).toBe(
        true
      );
    });

    it("rejects sponsor email same as user email", () => {
      const userEmail = "test@nyu.edu";
      expect(validateSponsorEmail(userEmail, userEmail)).toBe(
        "Sponsor email cannot be your own email"
      );
    });
  });

  describe("Expected Attendance Validation", () => {
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

    it("validates correct attendance within capacity", () => {
      expect(validateExpectedAttendance("10", 20)).toBe(true);
      expect(validateExpectedAttendance("1", 20)).toBe(true);
      expect(validateExpectedAttendance("20", 20)).toBe(true);
    });

    it("rejects non-numeric input", () => {
      expect(validateExpectedAttendance("abc", 20)).toBe("Enter a number");
      expect(validateExpectedAttendance("", 20)).toBe("Enter a number");
      expect(validateExpectedAttendance("ten", 20)).toBe("Enter a number");
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
      expect(validateExpectedAttendance("25", 20)).toBe(
        "Expected attendance exceeds maximum capacity of 20"
      );
      expect(validateExpectedAttendance("100", 50)).toBe(
        "Expected attendance exceeds maximum capacity of 50"
      );
    });
  });

  describe("Title Length Validation", () => {
    const validateTitleLength = (value: string, maxLength: number = 25) => {
      if (value.length > maxLength) {
        return `Title must be ${maxLength} characters or less`;
      }
      return true;
    };

    it("validates titles within length limit", () => {
      expect(validateTitleLength("Short title")).toBe(true);
      expect(validateTitleLength("Exactly 25 characters!")).toBe(true);
      expect(validateTitleLength("")).toBe(true); // Empty is valid for length check
    });

    it("rejects titles exceeding length limit", () => {
      const longTitle =
        "This is a very long title that exceeds the 25 character limit";
      expect(validateTitleLength(longTitle)).toBe(
        "Title must be 25 characters or less"
      );
    });
  });

  describe("Chart Field Validation", () => {
    const validateChartField = (value: string, isRequired: boolean) => {
      if (isRequired && (!value || value.trim().length === 0)) {
        return "Chart field is required";
      }
      return true;
    };

    it("validates required chart field with value", () => {
      expect(validateChartField("12345", true)).toBe(true);
      expect(validateChartField("CHART-123", true)).toBe(true);
    });

    it("rejects empty required chart field", () => {
      expect(validateChartField("", true)).toBe("Chart field is required");
      expect(validateChartField("   ", true)).toBe("Chart field is required");
    });

    it("allows empty optional chart field", () => {
      expect(validateChartField("", false)).toBe(true);
      expect(validateChartField("   ", false)).toBe(true);
    });
  });

  describe("Form Completeness Validation", () => {
    interface FormData {
      firstName?: string;
      lastName?: string;
      phoneNumber?: string;
      title?: string;
      expectedAttendance?: string;
      bookingType?: string;
    }

    const validateFormCompleteness = (
      data: FormData,
      requiredFields: string[]
    ) => {
      const missingFields = requiredFields.filter((field) => {
        const value = data[field as keyof FormData];
        return !value || value.toString().trim().length === 0;
      });

      if (missingFields.length > 0) {
        return `Missing required fields: ${missingFields.join(", ")}`;
      }
      return true;
    };

    it("validates complete form", () => {
      const completeData = {
        firstName: "John",
        lastName: "Doe",
        phoneNumber: "212-555-1234",
        title: "Meeting",
        expectedAttendance: "10",
        bookingType: "Academic",
      };

      const requiredFields = ["firstName", "lastName", "phoneNumber", "title"];
      expect(validateFormCompleteness(completeData, requiredFields)).toBe(true);
    });

    it("identifies missing required fields", () => {
      const incompleteData = {
        firstName: "John",
        phoneNumber: "212-555-1234",
        expectedAttendance: "10",
      };

      const requiredFields = ["firstName", "lastName", "phoneNumber", "title"];
      expect(validateFormCompleteness(incompleteData, requiredFields)).toBe(
        "Missing required fields: lastName, title"
      );
    });

    it("handles empty string values as missing", () => {
      const dataWithEmptyFields = {
        firstName: "John",
        lastName: "",
        phoneNumber: "   ",
        title: "Meeting",
      };

      const requiredFields = ["firstName", "lastName", "phoneNumber"];
      expect(
        validateFormCompleteness(dataWithEmptyFields, requiredFields)
      ).toBe("Missing required fields: lastName, phoneNumber");
    });
  });
});
