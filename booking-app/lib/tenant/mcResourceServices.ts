import type {
  Resource,
  ResourceServicesConfig,
} from "@/components/src/client/routes/components/schemaTypes";

const LAYOUTS_1201: ResourceServicesConfig["setup"] = {
  mode: "select",
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
      requiresChartField: true,
    },
    {
      value: "conference_style",
      label: "Conference Style - 28 Seated",
      requiresChartField: true,
    },
    {
      value: "workshop_a",
      label: "Workshop Style A - 36 Seated",
      requiresChartField: true,
    },
    {
      value: "workshop_b",
      label: "Workshop Style B - 56 Seated",
      requiresChartField: true,
    },
    {
      value: "empty_room",
      label: "Empty Room - 100 Standing",
      requiresChartField: true,
    },
  ],
};

const FURNISHINGS: ResourceServicesConfig["furnishings"] = {
  mode: "toggle",
  label: "Additional Event Furniture",
  descriptionHtml:
    "<p>See available event furniture in the room guide. Requesting additional furniture may require hiring CBS through a work order.</p>",
  chartFieldWhenYes: true,
};

export const MC_RESOURCE_SERVICES_1201: ResourceServicesConfig = {
  setup: LAYOUTS_1201,
  furnishings: FURNISHINGS,
  equipment: {
    mode: "static",
    label: "Equipment",
    descriptionHtml:
      "<p>1201 comes with the following equipment: Projector, Crestron System, 2 handheld mics, 3 lavalier microphones, PC with Zoom app. The microphones are located in a cabinet at the back of the room. For additional A/V services contact Campus Media.</p>",
  },
  catering: { mode: "toggle", label: "Catering", forceCleaning: true },
  cleaning: { mode: "toggle", label: "Cleaning" },
  security: { mode: "toggle", label: "Security" },
  auxiliarySpace: {
    enabled: true,
    label: "Request breakout space, lounge, or foyer",
    descriptionHtml:
      "<p>Check if your reservation requires use of breakout space, lounge, or foyer areas.</p>",
  },
};

export const MC_RESOURCE_SERVICES_202: ResourceServicesConfig = {
  setup: {
    mode: "select",
    label: "Room Setup",
    required: true,
    options: [{ value: "default", label: "Default layout" }],
  },
  furnishings: FURNISHINGS,
  equipment: {
    mode: "static",
    label: "Equipment",
    descriptionHtml:
      '<p>202 comes with the following equipment: 190" LED display, 6 handheld microphones, 2 lavalier microphones, PC with Zoom app. For additional A/V services contact Campus Media. The microphones are located in the AV closet which requires authorized ID card swipe access.</p>',
  },
  catering: {
    mode: "static",
    label: "Catering",
    descriptionHtml:
      "<p>Food is not permitted in this room. If your reservation requires catering, you may request to use the student lounge outside of the room. This is only available Friday–Sunday.</p>",
    studentLoungeCheckbox: true,
    forceCleaning: true,
  },
  cleaning: { mode: "toggle", label: "Cleaning" },
  security: { mode: "toggle", label: "Security" },
  auxiliarySpace: {
    enabled: true,
    label: "Student lounge approval",
  },
};

export const MC_RESOURCE_SERVICES_103: ResourceServicesConfig = {
  setup: {
    mode: "select",
    label: "Room Setup",
    descriptionHtml:
      '<p>For reference, please check the <a href="https://sites.google.com/nyu.edu/370jmediacommons/garage-audience-layouts" target="_blank" rel="noopener noreferrer">103 audience layouts</a>. *Options with an asterisk require hiring CBS through work order.</p>',
    defaultValue: "standing_room",
    required: true,
    options: [
      {
        value: "standing_room",
        label: "Standing Room (no chairs) - 74 Standing",
      },
      {
        value: "layout_1",
        label: "Audience Layout 1 - 44 Seated",
        requiresChartField: true,
      },
      {
        value: "layout_2",
        label: "Audience Layout 2 - 50 Seated",
        requiresChartField: true,
      },
      {
        value: "layout_3",
        label: "Audience Layout 3 - 60 Seated",
        requiresChartField: true,
      },
    ],
  },
  staffing: {
    mode: "toggle",
    label: "Staffing",
    descriptionHtml:
      "<p>Request audio/lighting technicians. Garage inventory requires a technician.</p>",
    sections: {
      lighting: {
        name: "Lighting",
        services: [
          {
            value: "LIGHTING_TECH_103",
            label: "(Garage 103) Request a lighting technician",
          },
        ],
      },
      audio: {
        name: "Audio",
        services: [
          {
            value: "AUDIO_TECH_103",
            label: "(Garage 103) Request an audio technician",
          },
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
    mode: "toggle",
    label: "Equipment",
    descriptionHtml:
      '<p>For DIY reservations, Plug &amp; Play equipment includes: 4x wireless handheld microphones, aux cable for stereo audio playback, video projector + stereo audio playback, Leprecon lighting board with basic wash presets. To request equipment from the Garage inventory, you must request a technician in the Staffing section.</p>',
    showDetailsField: true,
    detailsLabel: "Equipment request details",
  },
  catering: { mode: "toggle", label: "Catering", forceCleaning: true },
  cleaning: { mode: "toggle", label: "Cleaning" },
  security: {
    mode: "select",
    label: "Security",
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
        requiresChartField: true,
      },
    ],
  },
  auxiliarySpace: {
    enabled: true,
    label: "Green room approval",
    descriptionHtml:
      "<p>Check if your reservation requires use of the green room.</p>",
  },
};

export const MC_RESOURCE_SERVICES_233: ResourceServicesConfig = {
  setup: {
    mode: "select",
    label: "Room Setup",
    descriptionHtml:
      "<p>*Options with an asterisk require hiring CBS through work order. Additional layouts may be added when available.</p>",
    required: true,
    options: [
      {
        value: "classroom_style",
        label: "Classroom Style - 50 Seated",
        requiresChartField: true,
      },
    ],
  },
  furnishings: FURNISHINGS,
  equipment: {
    mode: "toggle",
    label: "Equipment",
    descriptionHtml:
      "<p>233 comes with a 75\" TV cart, a set of PA speakers on stands. Two wired handheld mics are available by request.</p>",
    showDetailsField: true,
    detailsLabel: "Additional Equipment",
  },
  catering: { mode: "toggle", label: "Catering", forceCleaning: true },
  cleaning: { mode: "toggle", label: "Cleaning" },
  security: { mode: "toggle", label: "Security" },
};

export const MC_RESOURCE_SERVICES_230: ResourceServicesConfig = {
  setup: { mode: "hidden" },
  equipment: {
    mode: "toggle",
    label: "Equipment",
    descriptionHtml:
      "<p>Always available in the SAI Studio: Audio Playback in the Live Room.<br/>Always available for checkout from the front desk: General Media Commons Inventory.<br/>Only available with an Audio Tech staffed: SAI Studio Inventory.</p>",
  },
  catering: {
    mode: "toggle",
    label: "Catering",
    forceCleaning: true,
    hideForUser: true,
  },
  cleaning: { mode: "toggle", label: "Cleaning", hideForUser: true },
  security: { mode: "toggle", label: "Security", hideForUser: true },
};

export const MC_RESOURCE_SERVICES_220: ResourceServicesConfig = {
  setup: { mode: "hidden" },
  equipment: {
    mode: "toggle",
    label: "Equipment",
    descriptionHtml:
      "<p>If you selected Equipment Services above, please describe your needs in detail.</p>",
  },
  staffing: {
    mode: "toggle",
    label: "Staffing",
    sections: {
      lighting: {
        name: "Lighting",
        services: [
          {
            value: "LIGHTING_DMX",
            label: "(Rooms 220-224) Using DMX lights in ceiling grid",
          },
        ],
      },
    },
  },
  catering: {
    mode: "toggle",
    label: "Catering",
    forceCleaning: true,
    hideForUser: true,
  },
  cleaning: { mode: "toggle", label: "Cleaning", hideForUser: true },
  security: { mode: "toggle", label: "Security", hideForUser: true },
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
  return {
    ...resource,
    services: mcServices,
  };
}

export function applyMcResourceServicesToAll(resources: Resource[]): Resource[] {
  return resources.map(applyMcResourceServices);
}
