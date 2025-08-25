import { describe, expect, it, vi } from "vitest";

describe("Form Utils", () => {
  describe("Form Field Generation", () => {
    const generateFormField = (
      id: string,
      label: string,
      required: boolean = true
    ) => {
      return {
        id,
        label: required ? `${label}*` : label,
        required,
        htmlFor: id,
      };
    };

    it("generates required field correctly", () => {
      const field = generateFormField("firstName", "First Name", true);
      expect(field).toEqual({
        id: "firstName",
        label: "First Name*",
        required: true,
        htmlFor: "firstName",
      });
    });

    it("generates optional field correctly", () => {
      const field = generateFormField("description", "Description", false);
      expect(field).toEqual({
        id: "description",
        label: "Description",
        required: false,
        htmlFor: "description",
      });
    });
  });

  describe("Form Section Formatting", () => {
    const formatSectionTitle = (title: string, prefix?: string) => {
      return prefix ? `${prefix} ${title}`.trim() : title;
    };

    it("formats section title without prefix", () => {
      expect(formatSectionTitle("Contact Information")).toBe(
        "Contact Information"
      );
    });

    it("formats section title with VIP prefix", () => {
      expect(formatSectionTitle("Contact Information", "VIP")).toBe(
        "VIP Contact Information"
      );
    });

    it("formats section title with Walk-In prefix", () => {
      expect(formatSectionTitle("Reservation Details", "Walk-In")).toBe(
        "Walk-In Reservation Details"
      );
    });

    it("handles empty prefix gracefully", () => {
      expect(formatSectionTitle("Services", "")).toBe("Services");
    });
  });

  describe("Form Data Transformation", () => {
    interface FormData {
      firstName?: string;
      lastName?: string;
      catering?: string;
      mediaServices?: string[];
      equipmentServices?: string[];
      staffingServices?: string[];
      expectedAttendance?: string;
    }

    const transformFormDataForSubmission = (data: FormData) => {
      return {
        ...data,
        expectedAttendance: data.expectedAttendance
          ? parseInt(data.expectedAttendance)
          : undefined,
        hasMediaServices: !!(
          data.mediaServices && data.mediaServices.length > 0
        ),
        hasEquipmentServices: !!(
          data.equipmentServices && data.equipmentServices.length > 0
        ),
        hasStaffingServices: !!(
          data.staffingServices && data.staffingServices.length > 0
        ),
        hasCatering: data.catering === "yes",
      };
    };

    it("transforms form data correctly", () => {
      const formData: FormData = {
        firstName: "John",
        lastName: "Doe",
        catering: "yes",
        mediaServices: ["projector", "microphone"],
        equipmentServices: ["camera"],
        staffingServices: ["audio tech"],
        expectedAttendance: "25",
      };

      const transformed = transformFormDataForSubmission(formData);
      expect(transformed).toEqual({
        firstName: "John",
        lastName: "Doe",
        catering: "yes",
        mediaServices: ["projector", "microphone"],
        equipmentServices: ["camera"],
        staffingServices: ["audio tech"],
        expectedAttendance: 25,
        hasMediaServices: true,
        hasEquipmentServices: true,
        hasStaffingServices: true,
        hasCatering: true,
      });
    });

    it("handles empty services", () => {
      const formData: FormData = {
        firstName: "John",
        lastName: "Doe",
        catering: "no",
        mediaServices: [],
        equipmentServices: [],
        staffingServices: [],
        expectedAttendance: "10",
      };

      const transformed = transformFormDataForSubmission(formData);
      expect(transformed.hasMediaServices).toBe(false);
      expect(transformed.hasEquipmentServices).toBe(false);
      expect(transformed.hasStaffingServices).toBe(false);
      expect(transformed.hasCatering).toBe(false);
    });

    it("handles undefined values", () => {
      const formData: FormData = {
        firstName: "John",
        lastName: "Doe",
      };

      const transformed = transformFormDataForSubmission(formData);
      expect(transformed.expectedAttendance).toBeUndefined();
      expect(transformed.hasMediaServices).toBe(false);
      expect(transformed.hasCatering).toBe(false);
    });
  });

  describe("Form Default Values", () => {
    interface UserApiData {
      preferred_first_name?: string;
      preferred_last_name?: string;
      university_id?: string;
      netid?: string;
    }

    const getDefaultValue = (
      userApiData: UserApiData | null,
      key: keyof UserApiData,
      isVIP: boolean = false,
      isWalkIn: boolean = false
    ): string => {
      // For VIP and walk-in bookings, we don't need identity data.
      if (isVIP || isWalkIn || !userApiData) return "";
      return userApiData[key] || "";
    };

    it("returns user data for regular booking", () => {
      const userData: UserApiData = {
        preferred_first_name: "John",
        preferred_last_name: "Doe",
        university_id: "N12345678",
        netid: "jd123",
      };

      expect(getDefaultValue(userData, "preferred_first_name")).toBe("John");
      expect(getDefaultValue(userData, "preferred_last_name")).toBe("Doe");
      expect(getDefaultValue(userData, "university_id")).toBe("N12345678");
      expect(getDefaultValue(userData, "netid")).toBe("jd123");
    });

    it("returns empty string for VIP booking", () => {
      const userData: UserApiData = {
        preferred_first_name: "John",
        preferred_last_name: "Doe",
      };

      expect(getDefaultValue(userData, "preferred_first_name", true)).toBe("");
      expect(getDefaultValue(userData, "preferred_last_name", true)).toBe("");
    });

    it("returns empty string for walk-in booking", () => {
      const userData: UserApiData = {
        preferred_first_name: "John",
        preferred_last_name: "Doe",
      };

      expect(
        getDefaultValue(userData, "preferred_first_name", false, true)
      ).toBe("");
      expect(
        getDefaultValue(userData, "preferred_last_name", false, true)
      ).toBe("");
    });

    it("returns empty string when user data is null", () => {
      expect(getDefaultValue(null, "preferred_first_name")).toBe("");
      expect(getDefaultValue(null, "university_id")).toBe("");
    });

    it("returns empty string for missing fields", () => {
      const incompleteUserData: UserApiData = {
        preferred_first_name: "John",
        // Missing other fields
      };

      expect(getDefaultValue(incompleteUserData, "preferred_last_name")).toBe(
        ""
      );
      expect(getDefaultValue(incompleteUserData, "university_id")).toBe("");
    });
  });

  describe("Form Field Dependencies", () => {
    interface FormValues {
      role?: string;
      catering?: string;
      roomSetup?: string;
      hireSecurity?: string;
      mediaServices?: string[];
      equipmentServices?: string[];
      staffingServices?: string[];
    }

    const getFieldDependencies = (formValues: FormValues) => {
      return {
        showSponsorFields: formValues.role === "Student",
        showCateringDetails: formValues.catering === "yes",
        showRoomSetupDetails: formValues.roomSetup === "yes",
        showSecurityDetails: formValues.hireSecurity === "yes",
        showMediaServicesDetails:
          formValues.mediaServices && formValues.mediaServices.length > 0,
        showEquipmentServicesDetails:
          formValues.equipmentServices && formValues.equipmentServices.length > 0,
        showStaffingServicesDetails:
          formValues.staffingServices && formValues.staffingServices.length > 0,
      };
    };

    it("shows sponsor fields for students", () => {
      const dependencies = getFieldDependencies({ role: "Student" });
      expect(dependencies.showSponsorFields).toBe(true);
    });

    it("hides sponsor fields for non-students", () => {
      const dependencies = getFieldDependencies({ role: "Faculty" });
      expect(dependencies.showSponsorFields).toBe(false);
    });

    it("shows catering details when catering is yes", () => {
      const dependencies = getFieldDependencies({ catering: "yes" });
      expect(dependencies.showCateringDetails).toBe(true);
    });

    it("hides catering details when catering is no", () => {
      const dependencies = getFieldDependencies({ catering: "no" });
      expect(dependencies.showCateringDetails).toBe(false);
    });

    it("shows room setup details when room setup is yes", () => {
      const dependencies = getFieldDependencies({ roomSetup: "yes" });
      expect(dependencies.showRoomSetupDetails).toBe(true);
    });

    it("shows media services details when services are selected", () => {
      const dependencies = getFieldDependencies({
        mediaServices: ["projector"],
      });
      expect(dependencies.showMediaServicesDetails).toBe(true);
    });

    it("hides media services details when no services selected", () => {
      const dependencies = getFieldDependencies({ mediaServices: [] });
      expect(dependencies.showMediaServicesDetails).toBe(false);
    });

    it("shows equipment services details when services are selected", () => {
      const dependencies = getFieldDependencies({
        equipmentServices: ["camera"],
      });
      expect(dependencies.showEquipmentServicesDetails).toBe(true);
    });

    it("hides equipment services details when no services selected", () => {
      const dependencies = getFieldDependencies({ equipmentServices: [] });
      expect(dependencies.showEquipmentServicesDetails).toBe(false);
    });

    it("shows staffing services details when services are selected", () => {
      const dependencies = getFieldDependencies({
        staffingServices: ["audio tech"],
      });
      expect(dependencies.showStaffingServicesDetails).toBe(true);
    });

    it("hides staffing services details when no services selected", () => {
      const dependencies = getFieldDependencies({ staffingServices: [] });
      expect(dependencies.showStaffingServicesDetails).toBe(false);
    });
  });

  describe("Form Submission Helpers", () => {
    const createFormSubmissionHandler = (
      onSubmit: (data: any) => void,
      isSubmitting: boolean
    ) => {
      return (e: Event) => {
        if (isSubmitting) {
          e.preventDefault();
          return false;
        }
        return true; // Allow normal submission
      };
    };

    it("prevents submission when already submitting", () => {
      const mockOnSubmit = vi.fn();
      const mockEvent = { preventDefault: vi.fn() } as any;

      const handler = createFormSubmissionHandler(mockOnSubmit, true);
      const result = handler(mockEvent);

      expect(mockEvent.preventDefault).toHaveBeenCalled();
      expect(result).toBe(false);
    });

    it("allows submission when not submitting", () => {
      const mockOnSubmit = vi.fn();
      const mockEvent = { preventDefault: vi.fn() } as any;

      const handler = createFormSubmissionHandler(mockOnSubmit, false);
      const result = handler(mockEvent);

      expect(mockEvent.preventDefault).not.toHaveBeenCalled();
      expect(result).toBe(true);
    });
  });

  describe("Agreement Validation", () => {
    interface Agreement {
      id: string;
      html: string;
    }

    const validateAgreements = (
      checkedAgreements: Record<string, boolean>,
      agreements: Agreement[]
    ) => {
      const allChecked = agreements.every(
        (agreement) => checkedAgreements[agreement.id] === true
      );
      const missingAgreements = agreements
        .filter((agreement) => !checkedAgreements[agreement.id])
        .map((agreement) => agreement.id);

      return {
        isValid: allChecked,
        missingAgreements,
      };
    };

    it("validates when all agreements are checked", () => {
      const agreements: Agreement[] = [
        { id: "terms", html: "Terms and conditions" },
        { id: "privacy", html: "Privacy policy" },
      ];
      const checkedAgreements = { terms: true, privacy: true };

      const result = validateAgreements(checkedAgreements, agreements);
      expect(result.isValid).toBe(true);
      expect(result.missingAgreements).toEqual([]);
    });

    it("identifies missing agreements", () => {
      const agreements: Agreement[] = [
        { id: "terms", html: "Terms and conditions" },
        { id: "privacy", html: "Privacy policy" },
        { id: "media", html: "Media usage" },
      ];
      const checkedAgreements = { terms: true, privacy: false, media: false };

      const result = validateAgreements(checkedAgreements, agreements);
      expect(result.isValid).toBe(false);
      expect(result.missingAgreements).toEqual(["privacy", "media"]);
    });

    it("handles empty agreements list", () => {
      const agreements: Agreement[] = [];
      const checkedAgreements = {};

      const result = validateAgreements(checkedAgreements, agreements);
      expect(result.isValid).toBe(true);
      expect(result.missingAgreements).toEqual([]);
    });
  });

  describe("Form Context Helpers", () => {
    enum FormContextLevel {
      FULL_FORM = "FULL_FORM",
      WALK_IN = "WALK_IN",
      VIP = "VIP",
      MODIFICATION = "MODIFICATION",
      EDIT = "EDIT",
    }

    const getFormContextInfo = (context: FormContextLevel) => {
      return {
        isWalkIn: context === FormContextLevel.WALK_IN,
        isMod: context === FormContextLevel.MODIFICATION,
        isFullForm: context === FormContextLevel.FULL_FORM,
        isVIP: context === FormContextLevel.VIP,
        isEdit: context === FormContextLevel.EDIT,
        isBooking:
          context !== FormContextLevel.WALK_IN &&
          context !== FormContextLevel.VIP,
      };
    };

    it("identifies walk-in context", () => {
      const info = getFormContextInfo(FormContextLevel.WALK_IN);
      expect(info.isWalkIn).toBe(true);
      expect(info.isBooking).toBe(false);
    });

    it("identifies VIP context", () => {
      const info = getFormContextInfo(FormContextLevel.VIP);
      expect(info.isVIP).toBe(true);
      expect(info.isBooking).toBe(false);
    });

    it("identifies full form context", () => {
      const info = getFormContextInfo(FormContextLevel.FULL_FORM);
      expect(info.isFullForm).toBe(true);
      expect(info.isBooking).toBe(true);
    });

    it("identifies modification context", () => {
      const info = getFormContextInfo(FormContextLevel.MODIFICATION);
      expect(info.isMod).toBe(true);
      expect(info.isBooking).toBe(true);
    });

    it("identifies edit context", () => {
      const info = getFormContextInfo(FormContextLevel.EDIT);
      expect(info.isEdit).toBe(true);
      expect(info.isBooking).toBe(true);
    });
  });

  describe("Form Validation State", () => {
    interface ValidationState {
      isBanned: boolean;
      needsSafetyTraining: boolean;
      isInBlackoutPeriod: boolean;
      agreementsChecked: boolean;
      isSubmitting: boolean;
    }

    const getSubmitButtonState = (state: ValidationState) => {
      const disabled =
        !state.agreementsChecked ||
        state.isBanned ||
        state.needsSafetyTraining ||
        state.isInBlackoutPeriod ||
        state.isSubmitting;

      let reason = "";
      if (state.isBanned) reason = "User is banned";
      else if (state.needsSafetyTraining) reason = "Safety training required";
      else if (state.isInBlackoutPeriod) reason = "Blackout period";
      else if (!state.agreementsChecked) reason = "Agreements not checked";
      else if (state.isSubmitting) reason = "Submitting";

      return { disabled, reason };
    };

    it("enables button when all conditions are met", () => {
      const state: ValidationState = {
        isBanned: false,
        needsSafetyTraining: false,
        isInBlackoutPeriod: false,
        agreementsChecked: true,
        isSubmitting: false,
      };

      const result = getSubmitButtonState(state);
      expect(result.disabled).toBe(false);
      expect(result.reason).toBe("");
    });

    it("disables button when user is banned", () => {
      const state: ValidationState = {
        isBanned: true,
        needsSafetyTraining: false,
        isInBlackoutPeriod: false,
        agreementsChecked: true,
        isSubmitting: false,
      };

      const result = getSubmitButtonState(state);
      expect(result.disabled).toBe(true);
      expect(result.reason).toBe("User is banned");
    });

    it("disables button when safety training is needed", () => {
      const state: ValidationState = {
        isBanned: false,
        needsSafetyTraining: true,
        isInBlackoutPeriod: false,
        agreementsChecked: true,
        isSubmitting: false,
      };

      const result = getSubmitButtonState(state);
      expect(result.disabled).toBe(true);
      expect(result.reason).toBe("Safety training required");
    });

    it("disables button during blackout period", () => {
      const state: ValidationState = {
        isBanned: false,
        needsSafetyTraining: false,
        isInBlackoutPeriod: true,
        agreementsChecked: true,
        isSubmitting: false,
      };

      const result = getSubmitButtonState(state);
      expect(result.disabled).toBe(true);
      expect(result.reason).toBe("Blackout period");
    });

    it("disables button when agreements not checked", () => {
      const state: ValidationState = {
        isBanned: false,
        needsSafetyTraining: false,
        isInBlackoutPeriod: false,
        agreementsChecked: false,
        isSubmitting: false,
      };

      const result = getSubmitButtonState(state);
      expect(result.disabled).toBe(true);
      expect(result.reason).toBe("Agreements not checked");
    });

    it("disables button when submitting", () => {
      const state: ValidationState = {
        isBanned: false,
        needsSafetyTraining: false,
        isInBlackoutPeriod: false,
        agreementsChecked: true,
        isSubmitting: true,
      };

      const result = getSubmitButtonState(state);
      expect(result.disabled).toBe(true);
      expect(result.reason).toBe("Submitting");
    });
  });

  describe("Max Capacity Calculation", () => {
    interface Room {
      roomId: string;
      capacity: string;
    }

    const calculateMaxCapacity = (selectedRooms: Room[]) => {
      return selectedRooms.reduce((sum, room) => {
        return sum + parseInt(room.capacity);
      }, 0);
    };

    it("calculates capacity for single room", () => {
      const rooms = [{ roomId: "room1", capacity: "25" }];
      expect(calculateMaxCapacity(rooms)).toBe(25);
    });

    it("calculates capacity for multiple rooms", () => {
      const rooms = [
        { roomId: "room1", capacity: "25" },
        { roomId: "room2", capacity: "30" },
        { roomId: "room3", capacity: "15" },
      ];
      expect(calculateMaxCapacity(rooms)).toBe(70);
    });

    it("handles empty room list", () => {
      const rooms: Room[] = [];
      expect(calculateMaxCapacity(rooms)).toBe(0);
    });

    it("handles zero capacity rooms", () => {
      const rooms = [
        { roomId: "room1", capacity: "0" },
        { roomId: "room2", capacity: "20" },
      ];
      expect(calculateMaxCapacity(rooms)).toBe(20);
    });
  });
});
