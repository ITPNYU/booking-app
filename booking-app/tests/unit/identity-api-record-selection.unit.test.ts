import { selectIdentityRecord } from "@/app/api/nyu/identity/[uniqueId]/route";
import { mapAffiliationToRole } from "@/components/src/client/routes/booking/formPages/UserRolePage";
import { Role } from "@/components/src/types";

describe("selectIdentityRecord", () => {
  it("returns the employee record when present in array", () => {
    const data = [
      { affiliation: "student", name: "Alice" },
      { affiliation: "employee", name: "Bob" },
    ];
    expect(selectIdentityRecord(data)).toEqual({
      affiliation: "employee",
      name: "Bob",
    });
  });

  it("returns the first record when no employee in array", () => {
    const data = [
      { affiliation: "student", name: "Alice" },
      { affiliation: "faculty", name: "Carol" },
    ];
    expect(selectIdentityRecord(data)).toEqual({
      affiliation: "student",
      name: "Alice",
    });
  });

  it("returns null for an empty array", () => {
    expect(selectIdentityRecord([])).toBeNull();
  });

  it("returns the object as-is for a single object (backward compat)", () => {
    const data = { affiliation: "employee", name: "Bob" };
    expect(selectIdentityRecord(data)).toEqual(data);
  });

  it("returns null for null input", () => {
    expect(selectIdentityRecord(null)).toBeNull();
  });

  it("returns null for undefined input", () => {
    expect(selectIdentityRecord(undefined)).toBeNull();
  });

  it("returns affiliate record (first) when no employee exists", () => {
    const data = [
      {
        affiliation: "affiliate",
        affiliation_sub_type: "contractor",
        reporting_dept_code: "PROVOST",
        school_name: "Provost",
      },
      {
        affiliation: "student",
        affiliation_sub_type: "degree",
        reporting_dept_code: "ITP",
        school_name: "TSOA",
      },
    ];
    const result = selectIdentityRecord(data);
    expect(result?.affiliation).toBe("affiliate");
    expect(result?.reporting_dept_code).toBe("PROVOST");
  });
});

describe("mapAffiliationToRole", () => {
  const roleMapping = {
    Student: ["STUDENT", "DEGREE"],
    "Resident/Fellow": ["FELLOW", "RESIDENT", "POST DOCTORAL FELLOW"],
    Faculty: ["FACULTY", "PROFESSOR", "ADJUNCT FACULTY", "LECTURER"],
    "Admin/Staff": ["ADMINISTRATOR", "STAFF", "EMPLOYEE", "CONTRACTOR"],
    "Chair/Program Director": ["CHAIR", "PROGRAM DIRECTOR"],
  };

  it("maps 'degree' to Student", () => {
    expect(mapAffiliationToRole(roleMapping, "degree")).toBe(Role.STUDENT);
  });

  it("maps 'contractor' to Admin/Staff", () => {
    expect(mapAffiliationToRole(roleMapping, "contractor")).toBe(
      Role.ADMIN_STAFF,
    );
  });

  it("maps 'employee' to Admin/Staff", () => {
    expect(mapAffiliationToRole(roleMapping, "employee")).toBe(
      Role.ADMIN_STAFF,
    );
  });

  it("maps 'faculty' to Faculty", () => {
    expect(mapAffiliationToRole(roleMapping, "faculty")).toBe(Role.FACULTY);
  });

  it("maps 'adjunct faculty' to Faculty", () => {
    expect(mapAffiliationToRole(roleMapping, "adjunct faculty")).toBe(
      Role.FACULTY,
    );
  });

  it("is case-insensitive", () => {
    expect(mapAffiliationToRole(roleMapping, "CONTRACTOR")).toBe(
      Role.ADMIN_STAFF,
    );
    expect(mapAffiliationToRole(roleMapping, "Degree")).toBe(Role.STUDENT);
  });

  it("returns undefined for unknown affiliation", () => {
    expect(mapAffiliationToRole(roleMapping, "unknown")).toBeUndefined();
  });

  it("returns undefined for undefined input", () => {
    expect(mapAffiliationToRole(roleMapping, undefined)).toBeUndefined();
  });
});
