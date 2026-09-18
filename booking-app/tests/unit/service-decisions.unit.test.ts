import { describe, expect, it } from "vitest";
import {
  getChangedServiceKeys,
  getServiceDecisions,
  MEDIA_COMMONS_SERVICE_KEYS,
  SERVICE_REQUEST_FIELDS,
} from "@/components/src/utils/serviceDecisions";
import { SERVICE_BY_ROOM_FIELDS } from "@/components/src/utils/resourceServicesUtils";
import { FLAT_SERVICE_FIELDS } from "@/components/src/utils/serviceSections";

/** A saved two-room booking with staff and catering requested. */
const saved = {
  title: "Original",
  expectedAttendance: "10",
  staffingServices: "audio_tech",
  catering: "yes",
  cateringByRoom: { "202": "yes", "203": "yes" },
  chartFieldForCateringByRoom: { "202": "AAAAA-BBBBB", "203": "AAAAA-BBBBB" },
  cleaningService: "",
  hireSecurity: "",
  roomSetupByRoom: { "202": "theater" },
  setupDetailsByRoom: { "202": "20 chairs" },
};

describe("getServiceDecisions", () => {
  it("reads only the booleans among the per-service approval flags", () => {
    expect(
      getServiceDecisions({
        staffServiceApproved: true,
        cateringServiceApproved: false,
        cleaningServiceApproved: null,
        setupServiceApproved: undefined,
      }),
    ).toEqual({ staff: true, catering: false });
  });

  it("has no decisions for a booking without flags", () => {
    expect(getServiceDecisions({ title: "x" })).toEqual({});
    expect(getServiceDecisions(undefined)).toEqual({});
  });
});

describe("getChangedServiceKeys", () => {
  it("changes no service when only Details fields differ", () => {
    expect(
      getChangedServiceKeys(saved, {
        ...saved,
        title: "Renamed",
        expectedAttendance: "40",
      }),
    ).toEqual([]);
  });

  it("changes nothing when the service requests are resubmitted as they were", () => {
    expect(getChangedServiceKeys(saved, { ...saved })).toEqual([]);
  });

  it("counts a per-room toggle change on one room", () => {
    expect(
      getChangedServiceKeys(saved, {
        ...saved,
        cateringByRoom: { "202": "yes", "203": "no" },
      }),
    ).toEqual(["catering"]);
  });

  it("counts a per-room chartfield change", () => {
    expect(
      getChangedServiceKeys(saved, {
        ...saved,
        chartFieldForCateringByRoom: {
          "202": "AAAAA-BBBBB",
          "203": "CCCCC-DDDDD",
        },
      }),
    ).toEqual(["catering"]);
  });

  it("counts a per-room detail text change", () => {
    expect(
      getChangedServiceKeys(saved, {
        ...saved,
        setupDetailsByRoom: { "202": "30 chairs" },
      }),
    ).toEqual(["setup"]);
  });

  it("counts a legacy flat field change", () => {
    expect(
      getChangedServiceKeys(saved, {
        ...saved,
        staffingServices: "lighting_tech",
      }),
    ).toEqual(["staff"]);
  });

  it("counts a newly requested service", () => {
    expect(
      getChangedServiceKeys(saved, {
        ...saved,
        hireSecurity: "yes",
        hireSecurityByRoom: { "202": "yes" },
      }),
    ).toEqual(["security"]);
  });

  it("lists every changed service in canonical key order", () => {
    expect(
      getChangedServiceKeys(saved, {
        ...saved,
        cateringByRoom: { "202": "no", "203": "no" },
        staffingServices: "",
        equipmentServicesDetailsByRoom: { "202": "2x mocap suits" },
      }),
    ).toEqual(["staff", "equipment", "catering"]);
  });

  it("treats an absent, empty and 'no' answer as the same unrequested state", () => {
    expect(
      getChangedServiceKeys(
        { ...saved, cleaningService: undefined, hireSecurity: "" },
        {
          ...saved,
          cleaningService: "no",
          hireSecurity: "No",
          cleaningByRoom: { "202": "no" },
          hireSecurityByRoom: {},
        },
      ),
    ).toEqual([]);
  });

  it("ignores surrounding whitespace in answers", () => {
    expect(
      getChangedServiceKeys(saved, {
        ...saved,
        setupDetailsByRoom: { "202": " 20 chairs " },
        staffingServices: "audio_tech ",
      }),
    ).toEqual([]);
  });

  describe("a booking saved before per-room maps existed", () => {
    // The existing-booking loader fans a legacy booking-level answer out
    // onto every room that offers the service, and the form derives the
    // flat scalars back from the maps. Neither is a change by the requester.
    const legacy = {
      title: "Original",
      catering: "yes",
      chartFieldForCatering: "AAAAA-BBBBB",
      hireSecurity: "willoughby",
      roomSetup: "yes",
      setupDetails: "20 chairs",
      chartFieldForRoomSetup: "CCCCC-DDDDD",
    };

    it("treats maps fanned out from the legacy answers as unchanged", () => {
      expect(
        getChangedServiceKeys(legacy, {
          ...legacy,
          chartFieldForCatering: "202 Lecture Hall: AAAAA-BBBBB; 203 Studio: AAAAA-BBBBB",
          cateringByRoom: { "202": "yes", "203": "yes" },
          chartFieldForCateringByRoom: {
            "202": "AAAAA-BBBBB",
            "203": "AAAAA-BBBBB",
          },
          hireSecurityByRoom: { "202": "willoughby" },
          roomSetupByRoom: { "202": "20 chairs" },
          setupDetailsByRoom: { "202": "20 chairs" },
          chartFieldForRoomSetupByRoom: { "202": "CCCCC-DDDDD" },
        }),
      ).toEqual([]);
    });

    it("still counts a room whose answer differs from the legacy one", () => {
      expect(
        getChangedServiceKeys(legacy, {
          ...legacy,
          cateringByRoom: { "202": "yes", "203": "yes" },
          chartFieldForCateringByRoom: {
            "202": "AAAAA-BBBBB",
            "203": "EEEEE-FFFFF",
          },
        }),
      ).toEqual(["catering"]);
    });

    it("counts a map with no legacy answer behind it as a new request", () => {
      expect(
        getChangedServiceKeys(
          { ...legacy, hireSecurity: "" },
          { ...legacy, hireSecurity: "", hireSecurityByRoom: { "202": "yes" } },
        ),
      ).toEqual(["security"]);
    });

    it("ignores the derived flat scalars once both sides carry maps", () => {
      const withMaps = {
        ...legacy,
        cateringByRoom: { "202": "yes" },
        chartFieldForCateringByRoom: { "202": "AAAAA-BBBBB" },
      };
      expect(
        getChangedServiceKeys(withMaps, {
          ...withMaps,
          chartFieldForCatering: "202 Lecture Hall: AAAAA-BBBBB",
        }),
      ).toEqual([]);
    });
  });

  it("covers every per-room map and every flat service field", () => {
    const covered = new Set(
      MEDIA_COMMONS_SERVICE_KEYS.flatMap((key) => SERVICE_REQUEST_FIELDS[key]),
    );
    for (const field of SERVICE_BY_ROOM_FIELDS) {
      expect(covered, field).toContain(field);
    }
    for (const fields of Object.values(FLAT_SERVICE_FIELDS)) {
      for (const field of fields) {
        expect(covered, field).toContain(field);
      }
    }
  });
});
