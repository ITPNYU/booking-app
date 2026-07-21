import type {
  Resource,
  ResourceServicesConfig,
} from "@/components/src/client/routes/components/schemaTypes";

const SHOW_ALL = { user: true, walkIn: true, VIP: true } as const;
/** VIP-only: hidden from standard user and walk-in origins. */
const VIP_ONLY = { user: false, walkIn: false, VIP: true } as const;

const CHARTFIELD_REQUIRED = {
  label: "Chartfield",
  required: true,
  validation: "CHARTFIELD_REGEX",
} as const;

const EVENT_FURNITURE_LINK =
  "https://sites.google.com/nyu.edu/370jmediacommons/rental-inventory/event-furniture";
const EQUIPMENT_INVENTORY_LINK =
  "https://sites.google.com/nyu.edu/370jmediacommons/rental-inventory";

function furnishingsHtml(roomFurnitureHtml: string): string {
  return `<p>${roomFurnitureHtml} See <a href="${EVENT_FURNITURE_LINK}" target="_blank" rel="noopener noreferrer">additional event furniture here</a>. Please note that requesting additional furniture will require hiring CBS through a work order.</p>`;
}

const EQUIPMENT_CHECKOUT_HTML = `<p>If you wish to check out equipment, please review <a href="${EQUIPMENT_INVENTORY_LINK}" target="_blank" rel="noopener noreferrer">our equipment inventory</a> and include your request below. Please describe your needs in detail (e.g., 2x Small Mocap Suits).</p>`;

const STAFFING_NONE = (room: string): ResourceServicesConfig["staffing"] => ({
  showInOrigin: SHOW_ALL,
  mode: "static",
  label: "Staffing?",
  descriptionHtml: `<p>There are no staffing options for Room ${room}.</p>`,
});

function vipDefaultSetup(
  layoutId: string,
  layoutLinkLabel: string,
  layoutHref: string,
): ResourceServicesConfig["setup"] {
  return {
    showInOrigin: VIP_ONLY,
    label: "Room Setup?",
    descriptionHtml: `<p>For reference, please check the <a href="${layoutHref}" target="_blank" rel="noopener noreferrer">${layoutLinkLabel}</a>.</p>`,
    mode: "radio",
    defaultValue: layoutId,
    required: true,
    options: [
      {
        value: layoutId,
        label: "Default Room Setup",
        chartField: CHARTFIELD_REQUIRED,
      },
    ],
  };
}

function switchService(
  label: string,
  showInOrigin: typeof SHOW_ALL | typeof VIP_ONLY,
  extras?: Partial<NonNullable<ResourceServicesConfig["catering"]>>,
): NonNullable<ResourceServicesConfig["catering"]> {
  return {
    showInOrigin,
    label,
    chartField: CHARTFIELD_REQUIRED,
    ...extras,
  };
}

export const MC_RESOURCE_SERVICES_103: ResourceServicesConfig = {
  annex: {
    showInOrigin: SHOW_ALL,
    mode: "radio",
    options: [{ value: "103GR", label: "Green Room" }],
  },
  setup: {
    showInOrigin: SHOW_ALL,
    label: "Room Setup?",
    descriptionHtml:
      '<p>For reference, please check the <a href="https://docs.google.com/document/d/1PQ3LRBFadWp7_IS-A9lAPImHOSKNteCa1-ikaTNOGbU/edit" target="_blank" rel="noopener noreferrer">Garage audience layouts</a>.</p>',
    mode: "radio",
    defaultValue: "103_LAYOUT_0",
    required: true,
    options: [
      {
        value: "103_LAYOUT_0",
        label: "Standing Room (no chairs) - 74 Standing",
      },
      {
        value: "103_LAYOUT_1",
        label: "Audience Layout 1 - 44 Seated",
        chartField: CHARTFIELD_REQUIRED,
      },
      {
        value: "103_LAYOUT_2",
        label: "Audience Layout 2 - 50 Seated",
        chartField: CHARTFIELD_REQUIRED,
      },
      {
        value: "103_LAYOUT_3",
        label: "Audience Layout 3 - 60 Seated",
        chartField: CHARTFIELD_REQUIRED,
      },
    ],
  },
  furnishings: {
    showInOrigin: SHOW_ALL,
    label: "Additional Event Furniture?",
    descriptionHtml: furnishingsHtml(
      'The following furniture is included with your Garage reservation: <a href="https://sites.google.com/nyu.edu/370jmediacommons/spaces/103-the-garage#h.mncvllnd2iz" target="_blank" rel="noopener noreferrer">Garage Room Furniture</a>.',
    ),
    chartField: CHARTFIELD_REQUIRED,
  },
  equipment: {
    showInOrigin: SHOW_ALL,
    mode: "static",
    label: "Equipment?",
    descriptionHtml:
      '<p>For DIY reservations, Plug &amp; Play equipment includes: 4x wireless handheld microphones, aux cable for stereo audio playback, video projector + stereo audio playback, Leprecon lighting board with basic wash presets. To request equipment from the Garage inventory, you must request a technician in the Staffing section.</p>',
  },
  staffing: {
    showInOrigin: SHOW_ALL,
    label: "Staffing?",
    sections: {
      lighting: {
        label: "Lighting",
        mode: "radio",
        defaultValue: "LIGHTING_TECH_DIY",
        options: [
          { value: "LIGHTING_TECH_DIY", label: "DIY - Basic Washes" },
          {
            value: "LIGHTING_TECH_SUPPORT_YOUR_OWN_BOARD",
            label: "Lighting Tech - Support Your Own Board Op",
          },
          { value: "LIGHTING_TECH_BUSKING", label: "Lighting Tech - Busking" },
          {
            value: "LIGHTING_TECH_DESIGN",
            label: "Lighting Tech - Lighting Design",
          },
        ],
      },
      audio: {
        label: "Audio",
        mode: "radio",
        defaultValue: "AUDIO_TECH_DIY",
        options: [
          { value: "AUDIO_TECH_DIY", label: "DIY - Plug & Play" },
          {
            value: "AUDIO_TECH_GENERAL",
            label: "Audio Tech - General House Tech",
          },
          {
            value: "AUDIO_TECH_RECORDING_ENGINEER",
            label: "Audio Tech - Recording Engineer",
          },
        ],
      },
    },
  },
  catering: switchService("Catering?", SHOW_ALL, { forceCleaning: true }),
  cleaning: switchService("Cleaning?", SHOW_ALL),
  security: switchService("Security?", SHOW_ALL),
};

export const MC_RESOURCE_SERVICES_202: ResourceServicesConfig = {
  annex: {
    showInOrigin: SHOW_ALL,
    mode: "radio",
    options: [
      { value: "202GR", label: "Green Room" },
      { value: "205", label: "Student Lounge" },
    ],
  },
  setup: {
    showInOrigin: SHOW_ALL,
    mode: "static",
    label: "Room Setup?",
    descriptionHtml: "<p>There are no room setup options for Room 202.</p>",
  },
  furnishings: {
    showInOrigin: SHOW_ALL,
    label: "Additional Event Furniture?",
    descriptionHtml: furnishingsHtml(
      'The following furniture is included with your Lecture Hall reservation: <a href="https://example.com" target="_blank" rel="noopener noreferrer">Lecture Hall Furniture</a>.',
    ),
    chartField: CHARTFIELD_REQUIRED,
  },
  equipment: {
    showInOrigin: SHOW_ALL,
    mode: "static",
    label: "Equipment?",
    descriptionHtml:
      "<p>Room 202 comes with the following equipment: 190” LED display, 6 handheld microphones, 2 lavalier microphones, PC with Zoom app. For additional A/V services contact Campus Media. The microphones are located in the AV closet which requires authorized ID card swipe access. Faculty and staff can contact <a href=\"mailto:mediacommons.reservations@nyu.edu\">mediacommons.reservations@nyu.edu</a> to request swipe access.</p>",
  },
  staffing: STAFFING_NONE("202"),
  catering: {
    showInOrigin: SHOW_ALL,
    label: "Catering?",
    descriptionHtml:
      "<p>Food is not permitted in room 202. If your reservation requires catering, you may request to use Room 205, the Student Lounge, outside of the Lecture Hall. The Student Lounge is only available Friday-Sunday.</p>",
    chartField: CHARTFIELD_REQUIRED,
    forceCleaning: true,
  },
  cleaning: switchService("Cleaning?", SHOW_ALL),
  security: switchService("Security?", SHOW_ALL),
};

function ballroomServices(
  resourceId: string,
): ResourceServicesConfig {
  return {
    setup: vipDefaultSetup(
      `${resourceId}_LAYOUT_0`,
      "Ballroom audience layouts",
      "https://example.com",
    ),
    furnishings: {
      showInOrigin: SHOW_ALL,
      label: "Additional Event Furniture?",
      descriptionHtml: furnishingsHtml(
        'The following furniture is included with your Ballroom reservation: <a href="https://sites.google.com/nyu.edu/370jmediacommons/spaces/221-224-ballrooms#h.py4aezgqk1v8" target="_blank" rel="noopener noreferrer">Ballroom Furniture</a>.',
      ),
      chartField: CHARTFIELD_REQUIRED,
    },
    equipment: {
      showInOrigin: SHOW_ALL,
      mode: "static",
      label: "Equipment?",
      descriptionHtml: EQUIPMENT_CHECKOUT_HTML,
      showDetailsField: true,
      detailsLabel: "Equipment request details",
    },
    staffing: STAFFING_NONE(resourceId),
    catering: switchService("Catering?", VIP_ONLY, { forceCleaning: true }),
    cleaning: switchService("Cleaning?", SHOW_ALL),
    security: switchService("Security?", SHOW_ALL),
  };
}

export const MC_RESOURCE_SERVICES_220: ResourceServicesConfig = {
  setup: vipDefaultSetup(
    "220_LAYOUT_0",
    "220 audience layouts",
    "https://example.com",
  ),
  furnishings: {
    showInOrigin: SHOW_ALL,
    label: "Additional Event Furniture?",
    descriptionHtml: furnishingsHtml(
      'The following furniture is included with your Black Box reservation: <a href="https://sites.google.com/nyu.edu/370jmediacommons/spaces/220-black-box#h.mwvylbk483wu" target="_blank" rel="noopener noreferrer">Black Box Furniture</a>.',
    ),
    chartField: CHARTFIELD_REQUIRED,
  },
  equipment: {
    showInOrigin: SHOW_ALL,
    mode: "static",
    label: "Equipment?",
    descriptionHtml: EQUIPMENT_CHECKOUT_HTML,
    showDetailsField: true,
    detailsLabel: "Equipment request details",
  },
  staffing: STAFFING_NONE("220"),
  catering: switchService("Catering?", VIP_ONLY, { forceCleaning: true }),
  cleaning: switchService("Cleaning?", SHOW_ALL),
  security: switchService("Security?", SHOW_ALL),
};

export const MC_RESOURCE_SERVICES_221 = ballroomServices("221");
export const MC_RESOURCE_SERVICES_222 = ballroomServices("222");
export const MC_RESOURCE_SERVICES_223 = ballroomServices("223");
export const MC_RESOURCE_SERVICES_224 = ballroomServices("224");

export const MC_RESOURCE_SERVICES_230: ResourceServicesConfig = {
  setup: vipDefaultSetup(
    "230_LAYOUT_0",
    "SAI Audio audience layouts",
    "https://example.com",
  ),
  furnishings: {
    showInOrigin: SHOW_ALL,
    label: "Additional Event Furniture?",
    descriptionHtml: furnishingsHtml(
      'The following furniture is included with your SAI Audio reservation: <a href="https://sites.google.com/nyu.edu/370jmediacommons/spaces/103-the-garage#h.mncvllnd2iz" target="_blank" rel="noopener noreferrer">SAI Audio Furniture</a>.',
    ),
    chartField: CHARTFIELD_REQUIRED,
  },
  equipment: {
    showInOrigin: SHOW_ALL,
    mode: "static",
    label: "Equipment?",
    descriptionHtml: EQUIPMENT_CHECKOUT_HTML,
    showDetailsField: true,
    detailsLabel: "Equipment request details",
  },
  staffing: {
    showInOrigin: SHOW_ALL,
    label: "Staffing?",
    sections: {
      audio: {
        label: "Audio",
        mode: "radio",
        defaultValue: "AUDIO_TECH_DIY",
        options: [
          { value: "AUDIO_TECH_DIY", label: "DIY - Plug & Play" },
          {
            value: "AUDIO_TECH_GENERAL",
            label: "Audio Tech - General House Tech",
          },
          { value: "AUDIO_TECH_A1", label: "Audio Tech - A1" },
        ],
      },
    },
  },
  catering: switchService("Catering?", VIP_ONLY, { forceCleaning: true }),
  cleaning: switchService("Cleaning?", SHOW_ALL),
  security: switchService("Security?", VIP_ONLY),
};

export const MC_RESOURCE_SERVICES_233: ResourceServicesConfig = {
  setup: {
    showInOrigin: SHOW_ALL,
    label: "Room Setup?",
    descriptionHtml:
      '<p>For reference, please check the <a href="https://example.com" target="_blank" rel="noopener noreferrer">Co-laboratory audience layouts</a>.</p>',
    mode: "radio",
    defaultValue: "233_LAYOUT_0",
    required: true,
    options: [
      { value: "233_LAYOUT_0", label: "Default Room Setup" },
    ],
  },
  furnishings: {
    showInOrigin: SHOW_ALL,
    label: "Additional Event Furniture?",
    descriptionHtml: furnishingsHtml(
      'The following furniture is included with your Co-laboratory reservation: <a href="https://sites.google.com/nyu.edu/370jmediacommons/spaces/233-co-lab#h.bxth8sepbu54" target="_blank" rel="noopener noreferrer">Co-laboratory Furniture</a>.',
    ),
    chartField: CHARTFIELD_REQUIRED,
  },
  equipment: {
    showInOrigin: SHOW_ALL,
    mode: "static",
    label: "Equipment?",
    descriptionHtml: EQUIPMENT_CHECKOUT_HTML,
    showDetailsField: true,
    detailsLabel: "Equipment request details",
  },
  staffing: STAFFING_NONE("233"),
  catering: switchService("Catering?", SHOW_ALL, { forceCleaning: true }),
  cleaning: switchService("Cleaning?", SHOW_ALL),
  security: switchService("Security?", SHOW_ALL),
};

export const MC_RESOURCE_SERVICES_260: ResourceServicesConfig = {
  setup: {
    showInOrigin: VIP_ONLY,
    label: "Room Setup?",
    descriptionHtml:
      '<p>For reference, please check the <a href="https://example.com" target="_blank" rel="noopener noreferrer">Post Production Lab room layouts</a>.</p>',
    mode: "radio",
    defaultValue: "260_LAYOUT_0",
    required: true,
    options: [
      { value: "260_LAYOUT_0", label: "Default Room Setup" },
    ],
  },
  furnishings: {
    showInOrigin: VIP_ONLY,
    label: "Additional Event Furniture?",
    descriptionHtml: furnishingsHtml(
      'The following furniture is included with your Post Production Lab reservation: <a href="https://sites.google.com/nyu.edu/370jmediacommons/spaces/260-post-lab#h.pvcy30r030yf" target="_blank" rel="noopener noreferrer">Post Production Lab Furniture</a>.',
    ),
    chartField: CHARTFIELD_REQUIRED,
  },
  equipment: {
    showInOrigin: VIP_ONLY,
    mode: "static",
    label: "Equipment?",
    descriptionHtml: EQUIPMENT_CHECKOUT_HTML,
    showDetailsField: true,
    detailsLabel: "Equipment request details",
  },
  staffing: STAFFING_NONE("260"),
  catering: switchService("Catering?", VIP_ONLY, { forceCleaning: true }),
  cleaning: switchService("Cleaning?", VIP_ONLY),
  security: switchService("Security?", VIP_ONLY),
};

export const MC_RESOURCE_SERVICES_1201: ResourceServicesConfig = {
  annex: {
    showInOrigin: SHOW_ALL,
    mode: "radio",
    options: [
      { value: "1200L-6", label: "Seminar Foyer" },
      { value: "1202", label: "Seminar Breakout" },
      { value: "1204", label: "Seminar Lounge" },
    ],
  },
  setup: {
    showInOrigin: SHOW_ALL,
    label: "Room Setup?",
    descriptionHtml:
      '<p>For reference, please check the <a href="https://drive.google.com/file/d/1xH415JMkSnhgzOj7sMLlYSUK57YWUR1w/view" target="_blank" rel="noopener noreferrer">Seminar Room layouts</a>.</p>',
    mode: "radio",
    defaultValue: "1201_LAYOUT_0",
    required: true,
    options: [
      {
        value: "1201_LAYOUT_0",
        label: "Lecture Layout (Default) - 84 Seated",
      },
      {
        value: "1201_LAYOUT_1",
        label: "Classroom Layout - 32 Seated",
        chartField: CHARTFIELD_REQUIRED,
      },
      {
        value: "1201_LAYOUT_2",
        label: "Conference Layout - 28 Seated",
        chartField: CHARTFIELD_REQUIRED,
      },
      {
        value: "1201_LAYOUT_3",
        label: "Workshop Layout A - 36 Seated",
        chartField: CHARTFIELD_REQUIRED,
      },
      {
        value: "1201_LAYOUT_4",
        label: "Workshop Layout B - 56 Seated",
        chartField: CHARTFIELD_REQUIRED,
      },
      {
        value: "1201_LAYOUT_5",
        label: "Empty Room - 100 Standing",
        chartField: CHARTFIELD_REQUIRED,
      },
    ],
  },
  furnishings: {
    showInOrigin: SHOW_ALL,
    label: "Additional Event Furniture?",
    descriptionHtml: furnishingsHtml(
      'The following furniture is included with your Seminar Room reservation: <a href="https://sites.google.com/nyu.edu/370jmediacommons/spaces/1201-seminar-room?authuser=0#h.ieh9npjizebn" target="_blank" rel="noopener noreferrer">Seminar Room Furniture</a>.',
    ),
    chartField: CHARTFIELD_REQUIRED,
  },
  equipment: {
    showInOrigin: SHOW_ALL,
    mode: "static",
    label: "Equipment?",
    descriptionHtml:
      "<p>The Seminar Room comes with the following equipment: Projector, Crestron System, 2 handheld mics, 3 lavalier microphones, PC with Zoom app. The microphones are located in a cabinet at the back of the room. For additional A/V services contact Campus Media.</p>",
  },
  staffing: STAFFING_NONE("1201"),
  catering: switchService("Catering?", SHOW_ALL, { forceCleaning: true }),
  cleaning: switchService("Cleaning?", SHOW_ALL),
  security: switchService("Security?", SHOW_ALL),
};

const MC_SERVICES_BY_ROOM: Record<string, ResourceServicesConfig> = {
  "103": MC_RESOURCE_SERVICES_103,
  "202": MC_RESOURCE_SERVICES_202,
  "220": MC_RESOURCE_SERVICES_220,
  "221": MC_RESOURCE_SERVICES_221,
  "222": MC_RESOURCE_SERVICES_222,
  "223": MC_RESOURCE_SERVICES_223,
  "224": MC_RESOURCE_SERVICES_224,
  "230": MC_RESOURCE_SERVICES_230,
  "233": MC_RESOURCE_SERVICES_233,
  "260": MC_RESOURCE_SERVICES_260,
  "1201": MC_RESOURCE_SERVICES_1201,
};

export function getMcResourceServices(
  resourceId: string,
): ResourceServicesConfig | undefined {
  return MC_SERVICES_BY_ROOM[resourceId];
}

export function applyMcResourceServices(resource: Resource): Resource {
  const mcServices = getMcResourceServices(resource.resourceId);
  if (!mcServices) return resource;

  const { services } = resource;
  // Preserve admin-authored configs: non-empty object or non-empty legacy array.
  if (Array.isArray(services) && services.length > 0) {
    return resource;
  }
  if (
    services &&
    typeof services === "object" &&
    !Array.isArray(services) &&
    Object.keys(services).length > 0
  ) {
    return resource;
  }

  return {
    ...resource,
    services: mcServices,
  };
}
