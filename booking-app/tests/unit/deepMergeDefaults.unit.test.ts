import { describe, expect, it } from "vitest";
import { deepMergeDefaults } from "../../scripts/schemaDefaults";

describe("deepMergeDefaults", () => {
  it("preserves existing values for keys in defaults", () => {
    const existing = { name: "ITP", logo: "itp.png" };
    const defaults = { name: "", logo: "", policy: "default policy" };
    const result = deepMergeDefaults(existing, defaults);

    expect(result.name).toBe("ITP");
    expect(result.logo).toBe("itp.png");
    expect(result.policy).toBe("default policy");
  });

  it("removes extra keys not in defaults", () => {
    const existing = { name: "ITP", obsoleteField: "gone" };
    const defaults = { name: "" };
    const result = deepMergeDefaults(existing, defaults);

    expect(result.name).toBe("ITP");
    expect(result).not.toHaveProperty("obsoleteField");
  });

  it("preserves mapping objects when default is empty object", () => {
    const existing = {
      roleMapping: {
        Student: ["SY"],
        Faculty: ["FT", "RA"],
        "Admin/Staff": ["SF"],
      },
      schoolMapping: {
        Tisch: ["TSOA"],
        Tandon: ["TANT"],
      },
      programMapping: {
        ITP: ["UY9300"],
        IMA: ["UY9400"],
      },
    };
    const defaults = {
      roleMapping: {},
      schoolMapping: {},
      programMapping: {},
    };

    const result = deepMergeDefaults(existing, defaults);

    expect(result.roleMapping).toEqual({
      Student: ["SY"],
      Faculty: ["FT", "RA"],
      "Admin/Staff": ["SF"],
    });
    expect(result.schoolMapping).toEqual({
      Tisch: ["TSOA"],
      Tandon: ["TANT"],
    });
    expect(result.programMapping).toEqual({
      ITP: ["UY9300"],
      IMA: ["UY9400"],
    });
  });

  it("uses default empty object when existing mapping is missing", () => {
    const existing = {};
    const defaults = { roleMapping: {}, schoolMapping: {} };
    const result = deepMergeDefaults(existing, defaults);

    expect(result.roleMapping).toEqual({});
    expect(result.schoolMapping).toEqual({});
  });

  it("recursively merges nested objects with non-empty defaults", () => {
    const existing = {
      calendarConfig: {
        startHour: { student: "10:00:00" },
      },
    };
    const defaults = {
      calendarConfig: {
        startHour: { student: "09:00:00", faculty: "09:00:00" },
        slotUnit: { student: 15 },
      },
    };
    const result = deepMergeDefaults(existing, defaults);

    expect(result.calendarConfig.startHour.student).toBe("10:00:00");
    expect(result.calendarConfig.startHour.faculty).toBe("09:00:00");
    expect(result.calendarConfig.slotUnit).toEqual({ student: 15 });
  });

  it("preserves existing empty object when default is also empty", () => {
    const existing = { roleMapping: {} };
    const defaults = { roleMapping: {} };
    const result = deepMergeDefaults(existing, defaults);

    expect(result.roleMapping).toEqual({});
  });
});
