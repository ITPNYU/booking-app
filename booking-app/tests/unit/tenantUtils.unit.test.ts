import { describe, expect, it } from "vitest";
import {
  mapAffiliationToRole,
  mapDepartmentCode,
  isITP,
  isMediaCommons,
  shouldUseXState,
  getTenantFlags,
  getMediaCommonsServices,
} from "@/components/src/utils/tenantUtils";
import { TENANTS } from "@/components/src/constants/tenants";
import { Role } from "@/components/src/types";

describe("tenantUtils", () => {
  describe("mapAffiliationToRole", () => {
    const roleMapping = {
      Student: ["STUDENT", "UNDERGRADUATE", "GRADUATE"],
      Faculty: ["FACULTY", "PROFESSOR"],
      Staff: ["STAFF", "EMPLOYEE"],
    };

    it("should map affiliation to role correctly", () => {
      expect(mapAffiliationToRole(roleMapping, "student")).toBe("Student");
      expect(mapAffiliationToRole(roleMapping, "STUDENT")).toBe("Student");
      expect(mapAffiliationToRole(roleMapping, "undergraduate")).toBe("Student");
      expect(mapAffiliationToRole(roleMapping, "FACULTY")).toBe("Faculty");
      expect(mapAffiliationToRole(roleMapping, "faculty")).toBe("Faculty");
      expect(mapAffiliationToRole(roleMapping, "staff")).toBe("Staff");
    });

    it("should return undefined for unknown affiliation", () => {
      expect(mapAffiliationToRole(roleMapping, "unknown")).toBeUndefined();
      expect(mapAffiliationToRole(roleMapping, "VISITOR")).toBeUndefined();
    });

    it("should return undefined when affiliation is not provided", () => {
      expect(mapAffiliationToRole(roleMapping, undefined)).toBeUndefined();
      expect(mapAffiliationToRole(roleMapping, "")).toBeUndefined();
    });

    it("should handle case-insensitive matching", () => {
      expect(mapAffiliationToRole(roleMapping, "StUdEnT")).toBe("Student");
      expect(mapAffiliationToRole(roleMapping, "FaCuLtY")).toBe("Faculty");
    });

    it("should return first matching role when affiliation appears in multiple mappings", () => {
      const duplicateMapping = {
        Role1: ["SHARED"],
        Role2: ["SHARED"],
      };
      const result = mapAffiliationToRole(duplicateMapping, "SHARED");
      expect(["Role1", "Role2"]).toContain(result);
    });

    it("should work with empty roleMapping", () => {
      expect(mapAffiliationToRole({}, "student")).toBeUndefined();
    });
  });

  describe("mapDepartmentCode", () => {
    const programMapping = {
      Engineering: ["CS", "EE", "ME"],
      Arts: ["ART", "MUSIC", "THEATER"],
      Business: ["MBA", "FINANCE"],
    };

    it("should map department code to department correctly", () => {
      expect(mapDepartmentCode(programMapping, "cs")).toBe("Engineering");
      expect(mapDepartmentCode(programMapping, "CS")).toBe("Engineering");
      expect(mapDepartmentCode(programMapping, "ee")).toBe("Engineering");
      expect(mapDepartmentCode(programMapping, "ART")).toBe("Arts");
      expect(mapDepartmentCode(programMapping, "art")).toBe("Arts");
      expect(mapDepartmentCode(programMapping, "MBA")).toBe("Business");
    });

    it("should return undefined for unknown department code", () => {
      expect(mapDepartmentCode(programMapping, "unknown")).toBeUndefined();
      expect(mapDepartmentCode(programMapping, "XYZ")).toBeUndefined();
    });

    it("should return undefined when department code is not provided", () => {
      expect(mapDepartmentCode(programMapping, undefined)).toBeUndefined();
      expect(mapDepartmentCode(programMapping, "")).toBeUndefined();
    });

    it("should handle case-insensitive matching", () => {
      expect(mapDepartmentCode(programMapping, "cS")).toBe("Engineering");
      expect(mapDepartmentCode(programMapping, "ArT")).toBe("Arts");
    });

    it("should work with empty programMapping", () => {
      expect(mapDepartmentCode({}, "CS")).toBeUndefined();
    });
  });

  describe("isITP", () => {
    it("should return true for ITP tenant", () => {
      expect(isITP(TENANTS.ITP)).toBe(true);
      expect(isITP("itp")).toBe(true);
    });

    it("should return false for non-ITP tenants", () => {
      expect(isITP(TENANTS.MC)).toBe(false);
      expect(isITP(TENANTS.MEDIA_COMMONS)).toBe(false);
      expect(isITP("mediaCommons")).toBe(false);
      expect(isITP("mc")).toBe(false);
    });

    it("should return false for undefined tenant", () => {
      expect(isITP(undefined)).toBe(false);
      expect(isITP("")).toBe(false);
    });

    it("should return false for unknown tenant", () => {
      expect(isITP("unknown")).toBe(false);
    });
  });

  describe("isMediaCommons", () => {
    it("should return true for Media Commons tenant", () => {
      expect(isMediaCommons(TENANTS.MC)).toBe(true);
      expect(isMediaCommons(TENANTS.MEDIA_COMMONS)).toBe(true);
      expect(isMediaCommons("mc")).toBe(true);
      expect(isMediaCommons("mediaCommons")).toBe(true);
    });

    it("should return false for non-Media Commons tenants", () => {
      expect(isMediaCommons(TENANTS.ITP)).toBe(false);
      expect(isMediaCommons("itp")).toBe(false);
    });

    it("should return false for undefined tenant", () => {
      expect(isMediaCommons(undefined)).toBe(false);
      expect(isMediaCommons("")).toBe(false);
    });

    it("should return false for unknown tenant", () => {
      expect(isMediaCommons("unknown")).toBe(false);
    });

    it("should handle both mc and mediaCommons formats", () => {
      // Both should be recognized as Media Commons
      expect(isMediaCommons("mc")).toBe(true);
      expect(isMediaCommons("mediaCommons")).toBe(true);
    });
  });

  describe("shouldUseXState", () => {
    it("should always return true", () => {
      expect(shouldUseXState(TENANTS.ITP)).toBe(true);
      expect(shouldUseXState(TENANTS.MC)).toBe(true);
      expect(shouldUseXState(TENANTS.MEDIA_COMMONS)).toBe(true);
      expect(shouldUseXState(undefined)).toBe(true);
      expect(shouldUseXState("unknown")).toBe(true);
    });
  });

  describe("getTenantFlags", () => {
    it("should return correct flags for ITP tenant", () => {
      const flags = getTenantFlags(TENANTS.ITP);
      expect(flags.isITP).toBe(true);
      expect(flags.isMediaCommons).toBe(false);
      expect(flags.usesXState).toBe(true);
    });

    it("should return correct flags for Media Commons tenant (mc)", () => {
      const flags = getTenantFlags(TENANTS.MC);
      expect(flags.isITP).toBe(false);
      expect(flags.isMediaCommons).toBe(true);
      expect(flags.usesXState).toBe(true);
    });

    it("should return correct flags for Media Commons tenant (mediaCommons)", () => {
      const flags = getTenantFlags(TENANTS.MEDIA_COMMONS);
      expect(flags.isITP).toBe(false);
      expect(flags.isMediaCommons).toBe(true);
      expect(flags.usesXState).toBe(true);
    });

    it("should return correct flags for undefined tenant", () => {
      const flags = getTenantFlags(undefined);
      expect(flags.isITP).toBe(false);
      expect(flags.isMediaCommons).toBe(false);
      expect(flags.usesXState).toBe(true);
    });

    it("should return correct flags for unknown tenant", () => {
      const flags = getTenantFlags("unknown");
      expect(flags.isITP).toBe(false);
      expect(flags.isMediaCommons).toBe(false);
      expect(flags.usesXState).toBe(true);
    });
  });

  describe("getMediaCommonsServices", () => {
    it("should return true for services when they are set", () => {
      const data = {
        roomSetup: "yes",
        staffingServicesDetails: "audio-tech",
        equipmentServices: "projector",
        catering: "lunch",
        cleaningService: "yes",
        hireSecurity: "yes",
      };

      const services = getMediaCommonsServices(data);
      expect(services.setup).toBe(true);
      expect(services.staff).toBe(true);
      expect(services.equipment).toBe(true);
      expect(services.catering).toBe(true);
      expect(services.cleaning).toBe(true);
      expect(services.security).toBe(true);
    });

    it("should return false for services when they are 'no'", () => {
      const data = {
        roomSetup: "no",
        staffingServicesDetails: "no",
        equipmentServices: "no",
        catering: "no",
        cleaningService: "no",
        hireSecurity: "no",
      };

      const services = getMediaCommonsServices(data);
      expect(services.setup).toBe(false);
      expect(services.staff).toBe(false);
      expect(services.equipment).toBe(false);
      expect(services.catering).toBe(false);
      expect(services.cleaning).toBe(false);
      expect(services.security).toBe(false);
    });

    it("should return false for services when they are undefined", () => {
      const data = {};

      const services = getMediaCommonsServices(data);
      expect(services.setup).toBe(false);
      expect(services.staff).toBe(false);
      expect(services.equipment).toBe(false);
      expect(services.catering).toBe(false);
      expect(services.cleaning).toBe(false);
      expect(services.security).toBe(false);
    });

    it("should return false for services when they are falsy", () => {
      const data = {
        roomSetup: false,
        staffingServicesDetails: null,
        equipmentServices: "",
        catering: undefined,
        cleaningService: 0,
        hireSecurity: false,
      };

      const services = getMediaCommonsServices(data);
      expect(services.setup).toBe(false);
      expect(services.staff).toBe(false);
      expect(services.equipment).toBe(false);
      expect(services.catering).toBe(false);
      expect(services.cleaning).toBe(false);
      expect(services.security).toBe(false);
    });

    it("should handle mixed service states", () => {
      const data = {
        roomSetup: "yes",
        staffingServicesDetails: "no",
        equipmentServices: "projector",
        catering: "no",
        cleaningService: "yes",
        hireSecurity: false,
      };

      const services = getMediaCommonsServices(data);
      expect(services.setup).toBe(true);
      expect(services.staff).toBe(false);
      expect(services.equipment).toBe(true);
      expect(services.catering).toBe(false);
      expect(services.cleaning).toBe(true);
      expect(services.security).toBe(false);
    });

    it("should treat any non-'no' string as true", () => {
      const data = {
        roomSetup: "maybe",
        staffingServicesDetails: "some details",
        equipmentServices: "multiple items",
        catering: "custom menu",
        cleaningService: "after event",
        hireSecurity: "2 guards",
      };

      const services = getMediaCommonsServices(data);
      expect(services.setup).toBe(true);
      expect(services.staff).toBe(true);
      expect(services.equipment).toBe(true);
      expect(services.catering).toBe(true);
      expect(services.cleaning).toBe(true);
      expect(services.security).toBe(true);
    });
  });
});

