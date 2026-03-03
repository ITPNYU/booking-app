import { describe, expect, it } from "vitest";
import { PagePermission } from "../../components/src/types";
import {
  getPathFromPermission,
  buildPathForPermission,
} from "../../components/src/utils/permissionPaths";

describe("permissionPaths utility functions", () => {
  describe("getPathFromPermission", () => {
    it("returns 'pa' for PA permission", () => {
      expect(getPathFromPermission(PagePermission.PA)).toBe("pa");
    });

    it("returns 'admin' for ADMIN permission", () => {
      expect(getPathFromPermission(PagePermission.ADMIN)).toBe("admin");
    });

    it("returns 'liaison' for LIAISON permission", () => {
      expect(getPathFromPermission(PagePermission.LIAISON)).toBe("liaison");
    });

    it("returns 'services' for SERVICES permission", () => {
      expect(getPathFromPermission(PagePermission.SERVICES)).toBe("services");
    });

    it("returns 'super' for SUPER_ADMIN permission", () => {
      expect(getPathFromPermission(PagePermission.SUPER_ADMIN)).toBe("super");
    });

    it("returns empty string for BOOKING permission", () => {
      expect(getPathFromPermission(PagePermission.BOOKING)).toBe("");
    });
  });

  describe("buildPathForPermission", () => {
    describe("with tenant", () => {
      it("builds correct path for ADMIN", () => {
        expect(buildPathForPermission("mc", PagePermission.ADMIN)).toBe(
          "/mc/admin"
        );
      });

      it("builds correct path for PA", () => {
        expect(buildPathForPermission("mc", PagePermission.PA)).toBe("/mc/pa");
      });

      it("builds correct path for LIAISON", () => {
        expect(buildPathForPermission("mc", PagePermission.LIAISON)).toBe(
          "/mc/liaison"
        );
      });

      it("builds correct path for SERVICES", () => {
        expect(buildPathForPermission("mc", PagePermission.SERVICES)).toBe(
          "/mc/services"
        );
      });

      it("builds correct path for SUPER_ADMIN", () => {
        expect(buildPathForPermission("mc", PagePermission.SUPER_ADMIN)).toBe(
          "/mc/super"
        );
      });

      it("builds root tenant path for BOOKING", () => {
        expect(buildPathForPermission("mc", PagePermission.BOOKING)).toBe(
          "/mc"
        );
      });
    });

    describe("without tenant", () => {
      it("builds correct path for ADMIN without tenant", () => {
        expect(buildPathForPermission(undefined, PagePermission.ADMIN)).toBe(
          "/admin"
        );
      });

      it("builds root path for BOOKING without tenant", () => {
        expect(buildPathForPermission(undefined, PagePermission.BOOKING)).toBe(
          "/"
        );
      });
    });
  });
});
