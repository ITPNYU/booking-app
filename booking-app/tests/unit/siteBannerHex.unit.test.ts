import { describe, expect, it } from "vitest";
import {
  DEFAULT_SITE_BANNER_COLOR_HEX,
  normalizeSiteBannerColorHex,
  parseStoredSiteBannerColorHex,
} from "@/lib/utils/siteBannerHex";

describe("siteBannerHex", () => {
  it("normalizes #RRGGBB to lowercase", () => {
    expect(normalizeSiteBannerColorHex("#7B1FA2")).toBe("#7b1fa2");
  });

  it("normalizes #RGB to #rrggbb", () => {
    expect(normalizeSiteBannerColorHex("#7Bf")).toBe("#77bbff");
  });

  it("returns null for invalid values", () => {
    expect(normalizeSiteBannerColorHex("#gg0000")).toBeNull();
    expect(normalizeSiteBannerColorHex("7b1fa2")).toBeNull();
    expect(normalizeSiteBannerColorHex("#7b1fa")).toBeNull();
    expect(normalizeSiteBannerColorHex("")).toBeNull();
  });

  it("parseStored falls back for bad stored values", () => {
    expect(parseStoredSiteBannerColorHex(undefined)).toBe(
      DEFAULT_SITE_BANNER_COLOR_HEX,
    );
    expect(parseStoredSiteBannerColorHex("#zz00aa")).toBe(
      DEFAULT_SITE_BANNER_COLOR_HEX,
    );
  });

  it("parseStored accepts valid stored hex", () => {
    expect(parseStoredSiteBannerColorHex("#00FFaa")).toBe("#00ffaa");
  });
});
