import type {
  Resource,
  ResourceServicesConfig,
} from "@/components/src/client/routes/components/schemaTypes";

const SHOW_ALL = { user: true, walkIn: true, VIP: true } as const;

const CHARTFIELD_REQUIRED = { required: true } as const;

const LAYOUTS_1201: ResourceServicesConfig["setup"] = {
  showInOrigin: SHOW_ALL,
  mode: "radio",
  label: "Room Setup",
  descriptionHtml:
    '<p>For reference, please check the <a href="https://sites.google.com/nyu.edu/370jmediacommons/1201-public-assembly" target="_blank" rel="noopener noreferrer">1201 Public Assembly layouts</a>. *Options with an asterisk require hiring CBS through work order.</p>',
  defaultValue: "lecture_style",
  required: true,
  options: [
    { value: "lecture_style", label: "Lecture Style (Default) - 84 Seated" },
    {
      value: "classroom_style",
      label: "Classroom Style - 32 Seated",
      chartField: CHARTFIELD_REQUIRED,
    },
    {
      value: "conference_style",
      label: "Conference Style - 28 Seated",
      chartField: CHARTFIELD_REQUIRED,
    },
    {
      value: "workshop_a",
      label: "Workshop Style A - 36 Seated",
      chartField: CHARTFIELD_REQUIRED,
    },
    {
      value: "workshop_b",
      label: "Workshop Style B - 56 Seated",
      chartField: CHARTFIELD_REQUIRED,
    },
    {
      value: "empty_room",
      label: "Empty Room - 100 Standing",
      chartField: CHARTFIELD_REQUIRED,
    },
  ],
};

const FURNISHINGS: ResourceServicesConfig["furnishings"] = {
  showInOrigin: SHOW_ALL,
  label: "Additional Event Furniture",
  descriptionHtml:
    "<p>See available event furniture in the room guide. Requesting additional furniture may require hiring CBS through a work order.</p>",
  chartField: CHARTFIELD_REQUIRED,
};

export const MC_RESOURCE_SERVICES_1201: ResourceServicesConfig = {
  setup: LAYOUTS_1201,
  furnishings: FURNISHINGS,
  equipment: {
    showInOrigin: SHOW_ALL,
    mode: "static",
    label: "Equipment",
    descriptionHtml:
      "<p>1201 comes with the following equipment: Projector, Crestron System, 2 handheld mics, 3 lavalier microphones, PC with Zoom app. The microphones are located in a cabinet at the back of the room. For additional A/V services contact Campus Media.</p>",
  },
  catering: {
    showInOrigin: SHOW_ALL,
    label: "Catering?",
    forceCleaning: true,
    chartField: CHARTFIELD_REQUIRED,
  },
  cleaning: {
    showInOrigin: SHOW_ALL,
    label: "Cleaning?",
    chartField: CHARTFIELD_REQUIRED,
  },
  security: {
    showInOrigin: SHOW_ALL,
    label: "Security?",
    chartField: CHARTFIELD_REQUIRED,
  },
  annex: {
    showInOrigin: SHOW_ALL,
    label: "Request breakout space, lounge, or foyer",
    descriptionHtml:
      "<p>Check if your reservation requires use of breakout space, lounge, or foyer areas.</p>",
  },
};

export const MC_RESOURCE_SERVICES_202: ResourceServicesConfig = {
  setup: {
    showInOrigin: SHOW_ALL,
    mode: "radio",
    label: "Room Setup",
    required: true,
    defaultValue: "default",
    options: [{ value: "default", label: "Default layout" }],
  },
  furnishings: FURNISHINGS,
  equipment: {
    showInOrigin: SHOW_ALL,
    mode: "static",
    label: "Equipment",
    descriptionHtml:
      '<p>202 comes with the following equipment: 190" LED display, 6 handheld microphones, 2 lavalier microphones, PC with Zoom app. For additional A/V services contact Campus Media. The microphones are located in the AV closet which requires authorized ID card swipe access.</p>',
  },
  catering: {
    showInOrigin: SHOW_ALL,
    mode: "static",
    label: "Catering",
    descriptionHtml:
      "<p>Food is not permitted in this room. If your reservation requires catering, you may request to use the student lounge outside of the room. This is only available Friday–Sunday.</p>",
    studentLoungeCheckbox: true,
    forceCleaning: true,
    chartField: CHARTFIELD_REQUIRED,
  },
  cleaning: {
    showInOrigin: SHOW_ALL,
    label: "Cleaning?",
    chartField: CHARTFIELD_REQUIRED,
  },
  security: {
    showInOrigin: SHOW_ALL,
    label: "Security?",
    chartField: CHARTFIELD_REQUIRED,
  },
  annex: {
    showInOrigin: SHOW_ALL,
    label: "Student lounge approval",
  },
};

export const MC_RESOURCE_SERVICES_103: ResourceServicesConfig = {
  annex: {
    showInOrigin: SHOW_ALL,
    label: "Auxiliary Spaces?",
    mode: "radio",
    defaultValue: "103GR",
    options: [{ value: "103GR", label: "Green Room" }],
  },
  setup: {
    showInOrigin: SHOW_ALL,
    mode: "radio",
    label: "Room Setup?",
    descriptionHtml:
      '<p>For reference, please check the <a href="https://docs.google.com/document/d/1PQ3LRBFadWp7_IS-A9lAPImHOSKNteCa1-ikaTNOGbU/edit" target="_blank" rel="noopener noreferrer">103 audience layouts</a>.</p>',
    defaultValue: "LAYOUT_0",
    required: true,
    options: [
      {
        value: "LAYOUT_0",
        label: "Standing Room (no chairs) - 74 Standing",
      },
      {
        value: "LAYOUT_1",
        label: "Audience Layout 1 - 44 Seated",
        chartField: CHARTFIELD_REQUIRED,
      },
      {
        value: "LAYOUT_2",
        label: "Audience Layout 2 - 50 Seated",
        chartField: CHARTFIELD_REQUIRED,
      },
      {
        value: "LAYOUT_3",
        label: "Audience Layout 3 - 60 Seated",
        chartField: CHARTFIELD_REQUIRED,
      },
    ],
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
          { value: "AUDIO_TECH_A1", label: "Audio Tech - A1" },
        ],
      },
    },
  },
  furnishings: {
    ...FURNISHINGS,
    descriptionHtml:
      "<p>The following furniture is included with your Garage reservation. See additional event furniture in the room guide. Requesting additional furniture may require hiring CBS through a work order.</p>",
  },
  equipment: {
    showInOrigin: SHOW_ALL,
    label: "Equipment",
    descriptionHtml:
      "<p>For DIY reservations, Plug &amp; Play equipment includes: 4x wireless handheld microphones, aux cable for stereo audio playback, video projector + stereo audio playback, Leprecon lighting board with basic wash presets. To request equipment from the Garage inventory, you must request a technician in the Staffing section.</p>",
    showDetailsField: true,
    detailsLabel: "Equipment request details",
  },
  catering: {
    showInOrigin: SHOW_ALL,
    label: "Catering?",
    forceCleaning: true,
    chartField: CHARTFIELD_REQUIRED,
  },
  cleaning: {
    showInOrigin: SHOW_ALL,
    label: "Cleaning?",
    chartField: CHARTFIELD_REQUIRED,
  },
  security: {
    showInOrigin: SHOW_ALL,
    mode: "radio",
    label: "Security?",
    required: true,
    options: [
      {
        value: "main_entrance",
        label:
          "No, I will check my guests in through the 370 Jay St main entrance",
      },
      {
        value: "willoughby",
        label:
          "Yes, we will need to use the Willoughby entrance and I understand additional fees will be required to hire a Campus Safety Officer",
        chartField: CHARTFIELD_REQUIRED,
      },
    ],
  },
};

export const MC_RESOURCE_SERVICES_233: ResourceServicesConfig = {
  setup: {
    showInOrigin: SHOW_ALL,
    mode: "radio",
    label: "Room Setup",
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
    label: "Equipment",
    descriptionHtml:
      '<p>233 comes with a 75" TV cart, a set of PA speakers on stands. Two wired handheld mics are available by request.</p>',
    showDetailsField: true,
    detailsLabel: "Additional Equipment",
  },
  catering: {
    showInOrigin: SHOW_ALL,
    label: "Catering?",
    forceCleaning: true,
    chartField: CHARTFIELD_REQUIRED,
  },
  cleaning: {
    showInOrigin: SHOW_ALL,
    label: "Cleaning?",
    chartField: CHARTFIELD_REQUIRED,
  },
  security: {
    showInOrigin: SHOW_ALL,
    label: "Security?",
    chartField: CHARTFIELD_REQUIRED,
  },
};

const VIP_ONLY = { user: false, walkIn: true, VIP: true } as const;

export const MC_RESOURCE_SERVICES_230: ResourceServicesConfig = {
  setup: { mode: "hidden" },
  equipment: {
    showInOrigin: SHOW_ALL,
    label: "Equipment",
    descriptionHtml:
      "<p>Always available in the SAI Studio: Audio Playback in the Live Room.<br/>Always available for checkout from the front desk: General Media Commons Inventory.<br/>Only available with an Audio Tech staffed: SAI Studio Inventory.</p>",
  },
  catering: {
    showInOrigin: VIP_ONLY,
    label: "Catering?",
    forceCleaning: true,
    chartField: CHARTFIELD_REQUIRED,
  },
  cleaning: {
    showInOrigin: VIP_ONLY,
    label: "Cleaning?",
    chartField: CHARTFIELD_REQUIRED,
  },
  security: {
    showInOrigin: VIP_ONLY,
    label: "Security?",
    chartField: CHARTFIELD_REQUIRED,
  },
};

export const MC_RESOURCE_SERVICES_220: ResourceServicesConfig = {
  setup: { mode: "hidden" },
  equipment: {
    showInOrigin: SHOW_ALL,
    label: "Equipment",
    descriptionHtml:
      "<p>If you selected Equipment Services above, please describe your needs in detail.</p>",
  },
  staffing: {
    showInOrigin: SHOW_ALL,
    label: "Staffing?",
    sections: {
      lighting: {
        label: "Lighting",
        mode: "radio",
        options: [
          {
            value: "LIGHTING_DMX",
            label: "(Rooms 220-224) Using DMX lights in ceiling grid",
          },
        ],
      },
    },
  },
  catering: {
    showInOrigin: VIP_ONLY,
    label: "Catering?",
    forceCleaning: true,
    chartField: CHARTFIELD_REQUIRED,
  },
  cleaning: {
    showInOrigin: VIP_ONLY,
    label: "Cleaning?",
    chartField: CHARTFIELD_REQUIRED,
  },
  security: {
    showInOrigin: VIP_ONLY,
    label: "Security?",
    chartField: CHARTFIELD_REQUIRED,
  },
};

const MC_SERVICES_BY_ROOM: Record<string, ResourceServicesConfig> = {
  "1201": MC_RESOURCE_SERVICES_1201,
  "202": MC_RESOURCE_SERVICES_202,
  "103": MC_RESOURCE_SERVICES_103,
  "233": MC_RESOURCE_SERVICES_233,
  "230": MC_RESOURCE_SERVICES_230,
  "220": MC_RESOURCE_SERVICES_220,
  "221": MC_RESOURCE_SERVICES_220,
  "222": MC_RESOURCE_SERVICES_220,
  "223": MC_RESOURCE_SERVICES_220,
  "224": MC_RESOURCE_SERVICES_220,
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
