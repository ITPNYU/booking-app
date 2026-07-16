import type {
  Resource,
  ResourceServicesConfig,
} from "@/components/src/client/routes/components/schemaTypes";

const SHOW_ALL = { user: true, walkIn: true, VIP: true } as const;

const VIP_ONLY = { user: false, walkIn: true, VIP: true } as const;

const SHOW_NONE = { user: false, walkIn: false, VIP: false } as const;

const MC_SERVICE_LABEL_SETUP = "Room Setup?" as const;

const MC_SERVICE_LABEL_FURNISHINGS = "Additional Event Furniture?" as const;

const MC_SERVICE_LABEL_EQUIPMENT = "Equipment?" as const;

const MC_SERVICE_LABEL_STAFFING = "Staffing?" as const;

const MC_SERVICE_LABEL_CATERING = "Catering?" as const;

const MC_SERVICE_LABEL_CLEANING = "Cleaning?" as const;

const MC_SERVICE_LABEL_SECURITY = "Security?" as const;

const CHARTFIELD_REQUIRED = {
  label: "Chartfield",
  descriptionHtml: "",
  required: true,
  validation: CHARTFIELD_REGEX,
} as const;

const MC_103_ENTRANCE_WILLOUGHBY = "Willoughby Street Entrance" as const;

const MC_221_TO_224_FURNISHINGS_DESCRIPTIONHTML =
  '<p>The following furniture is included with your Ballroom reservation: <a href="https://sites.google.com/nyu.edu/370jmediacommons/spaces/221-224-ballrooms#h.py4aezgqk1v8">Ballroom Furniture</a>. See <a href="https://sites.google.com/nyu.edu/370jmediacommons/rental-inventory/event-furniture" target="_blank" rel="noopener noreferrer">additional event furniture here</a>. Please note that requesting additional furniture will require hiring CBS through work order.</p>' as const;

const MC_220_TO_224_EQUIPMENT_DESCRIPTIONHTML =
  '<p>If you wish to check out equipment, please review <a href="https://sites.google.com/nyu.edu/370jmediacommons/rental-inventory">our equipment inventory</a> and include your request below. Please describe your needs in detail (e.g., 2x Small Mocap Suits).</p>' as const;

const FURNISHINGS: ResourceServicesConfig["furnishings"] = {
  showInOrigin: SHOW_ALL,
  label: MC_SERVICE_LABEL_FURNISHINGS,
  descriptionHtml:
    "<p>See available event furniture in the room guide. Requesting additional furniture may require hiring CBS through a work order.</p>",
  chartField: CHARTFIELD_REQUIRED,
};

export const MC_RESOURCE_SERVICES_103: ResourceServicesConfig = {
  annex: {
    showInOrigin: SHOW_ALL,
    options: [{ value: "103GR", label: "Garage Green Room" }],
  },
  setup: {
    showInOrigin: SHOW_ALL,
    label: MC_SERVICE_LABEL_SETUP,
    descriptionHtml:
      '<p>For reference, please check the <a href="https://docs.google.com/document/d/1PQ3LRBFadWp7_IS-A9lAPImHOSKNteCa1-ikaTNOGbU/edit" target="_blank" rel="noopener noreferrer">103 audience layouts</a>.</p>',
    mode: "radio",
    defaultValue: MC_103_LAYOUT_0,
    required: true,
    options: [
      {
        value: MC_103_LAYOUT_0,
        label: "Standing Room (no chairs) - 74 Standing",
      },
      {
        value: MC_103_LAYOUT_1,
        label: "Audience Layout 1 - 44 Seated",
        chartField: CHARTFIELD_REQUIRED,
      },
      {
        value: MC_103_LAYOUT_2,
        label: "Audience Layout 2 - 50 Seated",
        chartField: CHARTFIELD_REQUIRED,
      },
      {
        value: MC_103_LAYOUT_3,
        label: "Audience Layout 3 - 60 Seated",
        chartField: CHARTFIELD_REQUIRED,
      },
    ],
  },
  furnishings: {
    ...FURNISHINGS,
    descriptionHtml:
      "<p>The following furniture is included with your Garage reservation. See additional event furniture in the room guide. Requesting additional furniture may require hiring CBS through a work order.</p>",
  },
  equipment: {
    showInOrigin: SHOW_ALL,
    label: MC_SERVICE_LABEL_EQUIPMENT,
    descriptionHtml:
      "<p>For DIY reservations, Plug &amp; Play equipment includes: 4x wireless handheld microphones, aux cable for stereo audio playback, video projector + stereo audio playback, Leprecon lighting board with basic wash presets. To request equipment from the Garage inventory, you must request a technician in the Staffing section.</p>",
    showDetailsField: true,
    detailsLabel: "Equipment request details",
  },
  staffing: {
    showInOrigin: SHOW_ALL,
    label: MC_SERVICE_LABEL_STAFFING,
    descriptionHtml: "",
    sections: {
      lighting: {
        label: "Lighting",
        descriptionHtml: "",
        mode: "radio",
        defaultValue: MC_LIGHTING_TECH_DIY,
        options: [
          { value: MC_LIGHTING_TECH_DIY, label: "DIY - Basic Washes" },
          {
            value: MC_LIGHTING_TECH_SUPPORT_YOUR_OWN_BOARD,
            label: "Lighting Tech - Support Your Own Board Op",
          },
          { value: MC_LIGHTING_TECH_BUSKING, label: "Lighting Tech - Busking" },
          {
            value: MC_LIGHTING_TECH_DESIGN,
            label: "Lighting Tech - Lighting Design",
          },
        ],
      },
      audio: {
        label: "Audio",
        descriptionHtml: "",
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
  catering: {
    showInOrigin: SHOW_ALL,
    label: MC_SERVICE_LABEL_CATERING,
    descriptionHtml: "",
    chartField: CHARTFIELD_REQUIRED,
    forceCleaning: true,
  },
  cleaning: {
    showInOrigin: SHOW_ALL,
    label: MC_SERVICE_LABEL_CLEANING,
    descriptionHtml: "",
    chartField: CHARTFIELD_REQUIRED,
  },
  security: {
    showInOrigin: SHOW_ALL,
    label: MC_SERVICE_LABEL_SECURITY,
    descriptionHtml: "",
    mode: "radio",
    defaultValue: MC_103_ENTRANCE_WILLOUGHBY,
    required: true,
    options: [
      {
        value: MC_103_ENTRANCE_WILLOUGHBY,
        label:
          "I wish to use the Willoughby Street entrance and I understand additional fees will be required to hire a Campus Safety Officer",
        chartField: CHARTFIELD_REQUIRED,
      },
    ],
  },
};

export const MC_RESOURCE_SERVICES_202: ResourceServicesConfig = {
  annex: {
    showInOrigin: SHOW_ALL,
    options: [
      {
        value: "202GR",
        label: "Lecture Green Room",
      },
      {
        value: "205",
        label: "Student Lounge",
      },
    ],
  },
  setup: {
    showInOrigin: SHOW_ALL,
    mode: "radio",
    label: MC_SERVICE_LABEL_SETUP,
    required: true,
    defaultValue: "default",
    options: [{ value: "default", label: "Default layout" }],
  },
  furnishings: FURNISHINGS,
  equipment: {
    showInOrigin: SHOW_ALL,
    mode: "static",
    label: MC_SERVICE_LABEL_EQUIPMENT,
    descriptionHtml:
      '<p>202 comes with the following equipment: 190" LED display, 6 handheld microphones, 2 lavalier microphones, PC with Zoom app. For additional A/V services contact Campus Media. The microphones are located in the AV closet which requires authorized ID card swipe access.</p>',
  },
  catering: {
    showInOrigin: SHOW_ALL,
    mode: "static",
    label: MC_SERVICE_LABEL_CATERING,
    descriptionHtml:
      "<p>Food is not permitted in this room. If your reservation requires catering, you may request to use the student lounge outside of the room. This is only available Friday–Sunday.</p>",
    studentLoungeCheckbox: true,
    forceCleaning: true,
    chartField: CHARTFIELD_REQUIRED,
  },
  cleaning: {
    showInOrigin: SHOW_ALL,
    label: MC_SERVICE_LABEL_CLEANING,
    chartField: CHARTFIELD_REQUIRED,
  },
  security: {
    showInOrigin: SHOW_ALL,
    label: MC_SERVICE_LABEL_SECURITY,
    chartField: CHARTFIELD_REQUIRED,
  },
};

export const MC_RESOURCE_SERVICES_220: ResourceServicesConfig = {
  setup: {
    showInOrigin: VIP_ONLY,
    label: MC_SERVICE_LABEL_SETUP,
    descriptionHtml: "",
    options: [
      {
        value: MC_220_LAYOUT_CUSTOM,
        label: "Custom Room Setup",
        descriptionHtml: "Please describe the layout in detail.",
        chartField: CHARTFIELD_REQUIRED,
      },
    ],
  },
  furnishings: {
    showInOrigin: SHOW_ALL,
    label: MC_SERVICE_LABEL_FURNISHINGS,
    descriptionHtml:
      '<p>The following furniture is included with your Black Box reservation: <a href="https://sites.google.com/nyu.edu/370jmediacommons/spaces/220-black-box#h.mwvylbk483wu">Black Box Furniture</a>. See <a href="https://sites.google.com/nyu.edu/370jmediacommons/rental-inventory/event-furniture" target="_blank" rel="noopener noreferrer">additional event furniture here</a>. Please note that requesting additional furniture will require hiring CBS through work order.</p>',
    chartField: CHARTFIELD_REQUIRED,
  },
  equipment: {
    showInOrigin: SHOW_ALL,
    label: MC_SERVICE_LABEL_EQUIPMENT,
    descriptionHtml: MC_220_TO_224_EQUIPMENT_DESCRIPTIONHTML,
  },
  catering: {
    showInOrigin: VIP_ONLY,
    label: MC_SERVICE_LABEL_CATERING,
    descriptionHtml: "",
    forceCleaning: true,
    chartField: CHARTFIELD_REQUIRED,
  },
  cleaning: {
    showInOrigin: VIP_ONLY,
    label: MC_SERVICE_LABEL_CLEANING,
    descriptionHtml: "",
    chartField: CHARTFIELD_REQUIRED,
  },
  security: {
    showInOrigin: VIP_ONLY,
    label: MC_SERVICE_LABEL_SECURITY,
    descriptionHtml: "",
    chartField: CHARTFIELD_REQUIRED,
  },
};

export const MC_RESOURCE_SERVICES_221: ResourceServicesConfig = {
  setup: {
    showInOrigin: VIP_ONLY,
    label: MC_SERVICE_LABEL_SETUP,
    descriptionHtml: "",
    options: [
      {
        value: MC_221_LAYOUT_CUSTOM,
        label: "Custom Room Setup",
        descriptionHtml: "Please describe the layout in detail.",
        required: true,
        chartField: CHARTFIELD_REQUIRED,
      },
    ],
  },
  furnishings: {
    showInOrigin: SHOW_ALL,
    label: MC_SERVICE_LABEL_FURNISHINGS,
    descriptionHtml: MC_221_TO_224_FURNISHINGS_DESCRIPTIONHTML,
    chartField: CHARTFIELD_REQUIRED,
  },
  equipment: {
    showInOrigin: SHOW_ALL,
    label: MC_SERVICE_LABEL_EQUIPMENT,
    descriptionHtml:
      '<p>If you wish to check out equipment, please review <a href="https://sites.google.com/nyu.edu/370jmediacommons/rental-inventory">our equipment inventory</a> and include your request below. Please describe your needs in detail (e.g., 2x Small Mocap Suits).</p>',
  },
  catering: {
    showInOrigin: VIP_ONLY,
    label: MC_SERVICE_LABEL_CATERING,
    descriptionHtml: "",
    forceCleaning: true,
    chartField: CHARTFIELD_REQUIRED,
  },
  cleaning: {
    showInOrigin: VIP_ONLY,
    label: MC_SERVICE_LABEL_CLEANING,
    descriptionHtml: "",
    chartField: CHARTFIELD_REQUIRED,
  },
  security: {
    showInOrigin: VIP_ONLY,
    label: MC_SERVICE_LABEL_SECURITY,
    descriptionHtml: "",
    chartField: CHARTFIELD_REQUIRED,
  },
};

export const MC_RESOURCE_SERVICES_222: ResourceServicesConfig = {
  setup: {
    showInOrigin: VIP_ONLY,
    label: MC_SERVICE_LABEL_SETUP,
    descriptionHtml: "",
    options: [
      {
        value: MC_222_LAYOUT_CUSTOM,
        label: "Custom Room Setup",
        descriptionHtml: "Please describe the layout in detail.",
        chartField: CHARTFIELD_REQUIRED,
      },
    ],
  },
  furnishings: {
    showInOrigin: SHOW_ALL,
    label: MC_SERVICE_LABEL_FURNISHINGS,
    descriptionHtml: MC_221_TO_224_FURNISHINGS_DESCRIPTIONHTML,
    chartField: CHARTFIELD_REQUIRED,
  },
  equipment: {
    showInOrigin: SHOW_ALL,
    label: MC_SERVICE_LABEL_EQUIPMENT,
    descriptionHtml: MC_220_TO_224_EQUIPMENT_DESCRIPTIONHTML,
  },
  catering: {
    showInOrigin: VIP_ONLY,
    label: MC_SERVICE_LABEL_CATERING,
    descriptionHtml: "",
    forceCleaning: true,
    chartField: CHARTFIELD_REQUIRED,
  },
  cleaning: {
    showInOrigin: VIP_ONLY,
    label: MC_SERVICE_LABEL_CLEANING,
    descriptionHtml: "",
    chartField: CHARTFIELD_REQUIRED,
  },
  security: {
    showInOrigin: VIP_ONLY,
    label: MC_SERVICE_LABEL_SECURITY,
    descriptionHtml: "",
    chartField: CHARTFIELD_REQUIRED,
  },
};

export const MC_RESOURCE_SERVICES_223: ResourceServicesConfig = {
  setup: {
    showInOrigin: VIP_ONLY,
    label: MC_SERVICE_LABEL_SETUP,
    descriptionHtml: "",
    options: [
      {
        value: MC_223_LAYOUT_CUSTOM,
        label: "Custom Room Setup",
        descriptionHtml: "Please describe the layout in detail.",
        chartField: CHARTFIELD_REQUIRED,
      },
    ],
  },
  furnishings: {
    showInOrigin: SHOW_ALL,
    label: MC_SERVICE_LABEL_FURNISHINGS,
    descriptionHtml: MC_221_TO_224_FURNISHINGS_DESCRIPTIONHTML,
    chartField: CHARTFIELD_REQUIRED,
  },
  equipment: {
    showInOrigin: SHOW_ALL,
    label: MC_SERVICE_LABEL_EQUIPMENT,
    descriptionHtml: MC_220_TO_224_EQUIPMENT_DESCRIPTIONHTML,
  },
  catering: {
    showInOrigin: VIP_ONLY,
    label: MC_SERVICE_LABEL_CATERING,
    descriptionHtml: "",
    forceCleaning: true,
    chartField: CHARTFIELD_REQUIRED,
  },
  cleaning: {
    showInOrigin: VIP_ONLY,
    label: MC_SERVICE_LABEL_CLEANING,
    descriptionHtml: "",
    chartField: CHARTFIELD_REQUIRED,
  },
  security: {
    showInOrigin: VIP_ONLY,
    label: MC_SERVICE_LABEL_SECURITY,
    descriptionHtml: "",
    chartField: CHARTFIELD_REQUIRED,
  },
};

export const MC_RESOURCE_SERVICES_224: ResourceServicesConfig = {
  setup: {
    showInOrigin: VIP_ONLY,
    label: MC_SERVICE_LABEL_SETUP,
    descriptionHtml: "",
    options: [
      {
        value: MC_224_LAYOUT_CUSTOM,
        label: "Custom Room Setup",
        descriptionHtml: "Please describe the layout in detail.",
        chartField: CHARTFIELD_REQUIRED,
      },
    ],
  },
  furnishings: {
    showInOrigin: SHOW_ALL,
    label: MC_SERVICE_LABEL_FURNISHINGS,
    descriptionHtml: MC_221_TO_224_FURNISHINGS_DESCRIPTIONHTML,
    chartField: CHARTFIELD_REQUIRED,
  },
  equipment: {
    showInOrigin: SHOW_ALL,
    label: MC_SERVICE_LABEL_EQUIPMENT,
    descriptionHtml: MC_220_TO_224_EQUIPMENT_DESCRIPTIONHTML,
  },
  catering: {
    showInOrigin: VIP_ONLY,
    label: MC_SERVICE_LABEL_CATERING,
    descriptionHtml: "",
    forceCleaning: true,
    chartField: CHARTFIELD_REQUIRED,
  },
  cleaning: {
    showInOrigin: VIP_ONLY,
    label: MC_SERVICE_LABEL_CLEANING,
    descriptionHtml: "",
    chartField: CHARTFIELD_REQUIRED,
  },
  security: {
    showInOrigin: VIP_ONLY,
    label: MC_SERVICE_LABEL_SECURITY,
    descriptionHtml: "",
    chartField: CHARTFIELD_REQUIRED,
  },
};

export const MC_RESOURCE_SERVICES_230: ResourceServicesConfig = {
  setup: {
    showInOrigin: SHOW_NONE,
    label: MC_SERVICE_LABEL_SETUP,
    descriptionHtml: "",
    chartField: CHARTFIELD_REQUIRED,
  },
  equipment: {
    showInOrigin: SHOW_ALL,
    label: MC_SERVICE_LABEL_EQUIPMENT,
    descriptionHtml:
      "<p>Always available in the SAI Studio: Audio Playback in the Live Room.<br/>Always available for checkout from the front desk: General Media Commons Inventory.<br/>Only available with an Audio Tech staffed: SAI Studio Inventory.</p>",
  },
  catering: {
    showInOrigin: VIP_ONLY,
    label: MC_SERVICE_LABEL_CATERING,
    forceCleaning: true,
    chartField: CHARTFIELD_REQUIRED,
  },
  cleaning: {
    showInOrigin: VIP_ONLY,
    label: MC_SERVICE_LABEL_CLEANING,
    chartField: CHARTFIELD_REQUIRED,
  },
  security: {
    showInOrigin: VIP_ONLY,
    label: MC_SERVICE_LABEL_SECURITY,
    chartField: CHARTFIELD_REQUIRED,
  },
};

export const MC_RESOURCE_SERVICES_260: ResourceServicesConfig = {};

export const MC_RESOURCE_SERVICES_233: ResourceServicesConfig = {
  setup: {
    showInOrigin: SHOW_ALL,
    mode: "radio",
    label: MC_SERVICE_LABEL_SETUP,
    descriptionHtml:
      "<p>*Options with an asterisk require hiring CBS through work order. Additional layouts may be added when available.</p>",
    required: true,
    options: [
      {
        value: "classroom_style",
        label: "Classroom Style - 50 Seated",
        chartField: CHARTFIELD_REQUIRED,
      },
    ],
  },
  furnishings: FURNISHINGS,
  equipment: {
    showInOrigin: SHOW_ALL,
    label: MC_SERVICE_LABEL_EQUIPMENT,
    descriptionHtml:
      '<p>233 comes with a 75" TV cart, a set of PA speakers on stands. Two wired handheld mics are available by request.</p>',
    showDetailsField: true,
    detailsLabel: "Additional Equipment",
  },
  catering: {
    showInOrigin: SHOW_ALL,
    label: MC_SERVICE_LABEL_CATERING,
    forceCleaning: true,
    chartField: CHARTFIELD_REQUIRED,
  },
  cleaning: {
    showInOrigin: SHOW_ALL,
    label: MC_SERVICE_LABEL_CLEANING,
    chartField: CHARTFIELD_REQUIRED,
  },
  security: {
    showInOrigin: SHOW_ALL,
    label: MC_SERVICE_LABEL_SECURITY,
    chartField: CHARTFIELD_REQUIRED,
  },
};

export const MC_RESOURCE_SERVICES_1201: ResourceServicesConfig = {
  setup: {
    showInOrigin: SHOW_ALL,
    mode: "radio",
    label: MC_SERVICE_LABEL_SETUP,
    descriptionHtml:
      '<p>For reference, please check the <a href="https://sites.google.com/nyu.edu/370jmediacommons/1201-public-assembly" target="_blank" rel="noopener noreferrer">1201 Public Assembly layouts</a>. *Options with an asterisk require hiring CBS through work order.</p>',
    defaultValue: MC_1201_LAYOUT_0,
    required: true,
    options: [
      { value: MC_1201_LAYOUT_0, label: "Lecture Style (Default) - 84 Seated" },
      {
        value: MC_1201_LAYOUT_1,
        label: "Classroom Style - 32 Seated",
        chartField: CHARTFIELD_REQUIRED,
      },
      {
        value: MC_1201_LAYOUT_2,
        label: "Conference Style - 28 Seated",
        chartField: CHARTFIELD_REQUIRED,
      },
      {
        value: MC_1201_LAYOUT_3,
        label: "Workshop Style A - 36 Seated",
        chartField: CHARTFIELD_REQUIRED,
      },
      {
        value: MC_1201_LAYOUT_4,
        label: "Workshop Style B - 56 Seated",
        chartField: CHARTFIELD_REQUIRED,
      },
      {
        value: MC_1201_LAYOUT_5,
        label: "Empty Room - 100 Standing",
        chartField: CHARTFIELD_REQUIRED,
      },
    ],
  },
  furnishings: FURNISHINGS,
  equipment: {
    showInOrigin: SHOW_ALL,
    mode: "static",
    label: MC_SERVICE_LABEL_EQUIPMENT,
    descriptionHtml:
      "<p>1201 comes with the following equipment: Projector, Crestron System, 2 handheld mics, 3 lavalier microphones, PC with Zoom app. The microphones are located in a cabinet at the back of the room. For additional A/V services contact Campus Media.</p>",
  },
  catering: {
    showInOrigin: SHOW_ALL,
    label: MC_SERVICE_LABEL_CATERING,
    forceCleaning: true,
    chartField: CHARTFIELD_REQUIRED,
  },
  cleaning: {
    showInOrigin: SHOW_ALL,
    label: MC_SERVICE_LABEL_CLEANING,
    chartField: CHARTFIELD_REQUIRED,
  },
  security: {
    showInOrigin: SHOW_ALL,
    label: MC_SERVICE_LABEL_SECURITY,
    chartField: CHARTFIELD_REQUIRED,
  },
  annex: {
    showInOrigin: SHOW_ALL,
    label: "Request breakout space, lounge, or foyer",
    descriptionHtml:
      "<p>Check if your reservation requires use of breakout space, lounge, or foyer areas.</p>",
  },
};

const MC_SERVICES_BY_ROOM: Record<string, ResourceServicesConfig> = {
  "103": MC_RESOURCE_SERVICES_103,
  "202": MC_RESOURCE_SERVICES_202,
  "220": MC_RESOURCE_SERVICES_220,
  "221": MC_RESOURCE_SERVICES_221,
  "222": MC_RESOURCE_SERVICES_222,
  "223": MC_RESOURCE_SERVICES_223,
  "224": MC_RESOURCE_SERVICES_224,
  "233": MC_RESOURCE_SERVICES_233,
  "230": MC_RESOURCE_SERVICES_230,
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
