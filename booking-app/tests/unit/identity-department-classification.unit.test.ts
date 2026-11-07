import { describe, expect, it } from "vitest";

import { mapIdentityToDepartment } from "@/components/src/client/routes/booking/formPages/UserRolePage";
import { Department } from "@/components/src/types";
import {
  departmentsMatch,
  isItpGroupDepartment,
} from "@/components/src/utils/departmentUtils";
import { isItpGroupIdentity } from "@/components/src/utils/tenantUtils";

/** Real identity record shape for an IMA undergrad (hz3942), PII trimmed. */
const IMA_UNDERGRAD = {
  school_abbr: "TSOA",
  reporting_dept_code: "I_MEDIA_ARTS_UGP",
  reporting_dept_name: "Interactive Media Arts UG Program",
  affiliation: "student",
  affiliation_sub_type: "degree",
  dept_code: "UTIMNY",
  dept_name: null,
};

describe("isItpGroupIdentity", () => {
  it("recognizes an IMA undergrad by dept_code", () => {
    expect(isItpGroupIdentity(IMA_UNDERGRAD)).toBe(true);
  });

  it("is case-insensitive and ignores surrounding whitespace", () => {
    expect(isItpGroupIdentity({ dept_code: " utimny " })).toBe(true);
  });

  it("does not use reporting_dept_code", () => {
    expect(
      isItpGroupIdentity({ reporting_dept_code: "I_MEDIA_ARTS_UGP" } as any),
    ).toBe(false);
  });

  it("returns false for missing or unknown codes", () => {
    expect(isItpGroupIdentity(undefined)).toBe(false);
    expect(isItpGroupIdentity({ dept_code: null })).toBe(false);
    expect(isItpGroupIdentity({ dept_code: "STERN_FINANCE" })).toBe(false);
  });
});

describe("mapIdentityToDepartment", () => {
  const mcProgramMapping = {
    [Department.ITP]: ["ITP"],
    [Department.CDI]: ["CDI_CODE"],
    [Department.MARL]: ["MARL_REPORTING"],
  };

  it("maps an IMA undergrad to ITP / IMA / Low Res even when the mapping lacks their codes", () => {
    expect(mapIdentityToDepartment(mcProgramMapping, IMA_UNDERGRAD)).toBe(
      Department.ITP,
    );
  });

  it("does not pick ITP / IMA / Low Res when the tenant does not offer it", () => {
    expect(
      mapIdentityToDepartment({ [Department.CDI]: ["CDI_CODE"] }, IMA_UNDERGRAD),
    ).toBeUndefined();
  });

  it("matches the program mapping on dept_code", () => {
    expect(
      mapIdentityToDepartment(mcProgramMapping, { dept_code: "cdi_code" }),
    ).toBe(Department.CDI);
  });

  it("matches the program mapping on reporting_dept_code", () => {
    expect(
      mapIdentityToDepartment(mcProgramMapping, {
        dept_code: "UNMAPPED",
        reporting_dept_code: "MARL_REPORTING",
      }),
    ).toBe(Department.MARL);
  });

  it("returns undefined instead of Other when nothing matches", () => {
    expect(
      mapIdentityToDepartment(mcProgramMapping, {
        dept_code: "STERN_FINANCE",
        reporting_dept_code: "UG_FINANCE",
      }),
    ).toBeUndefined();
  });

  it("returns undefined for a missing identity or missing codes", () => {
    expect(mapIdentityToDepartment(mcProgramMapping, undefined)).toBeUndefined();
    expect(mapIdentityToDepartment(mcProgramMapping, {})).toBeUndefined();
  });

  it("returns undefined for an empty program mapping", () => {
    expect(mapIdentityToDepartment({}, { dept_code: "CDI_CODE" })).toBeUndefined();
  });
});

describe("isItpGroupDepartment", () => {
  it.each(["ITP", "ima", "Low Res", "low-res", "ITP / IMA / Low Res", "Interactive Media Arts UG Program"])(
    "treats %s as ITP group",
    (dept) => {
      expect(isItpGroupDepartment(dept)).toBe(true);
    },
  );

  it.each(["CDI", "Imaging Sciences", "Other", "", null, undefined])(
    "does not treat %s as ITP group",
    (dept) => {
      expect(isItpGroupDepartment(dept)).toBe(false);
    },
  );
});

describe("departmentsMatch", () => {
  it("matches ITP group labels with each other", () => {
    expect(departmentsMatch("IMA", "ITP / IMA / Low Res")).toBe(true);
    expect(departmentsMatch("Low Res", "ITP")).toBe(true);
  });

  it("matches other departments exactly, ignoring case and spaces", () => {
    expect(departmentsMatch("Music Tech", "music tech")).toBe(true);
    expect(departmentsMatch("Game Center", "GameCenter")).toBe(true);
    expect(departmentsMatch("CDI", "ALT")).toBe(false);
  });

  it("does not match an ITP group label with a non-ITP department", () => {
    expect(departmentsMatch("IMA", "CDI")).toBe(false);
    expect(departmentsMatch("ITP / IMA / Low Res", "Other")).toBe(false);
  });

  it("never matches empty departments", () => {
    expect(departmentsMatch("", "")).toBe(false);
    expect(departmentsMatch(null, undefined)).toBe(false);
  });
});
