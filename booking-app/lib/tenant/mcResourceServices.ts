import type {
  Resource,
  ResourceServicesConfig,
} from "@/components/src/client/routes/components/schemaTypes";

/** Default MC resource `services` configs keyed by resourceId (Firestore tenant schema shape). */
const MC_SERVICES_BY_ROOM: Record<string, ResourceServicesConfig> = {
  "103": {
    annex: {
      showInOrigin: {
        user: true,
        walkIn: true,
        VIP: true,
      },
      options: [
        {
          value: "103GR",
          label: "Garage Green Room",
        }
      ],
    },
    setup: {
      showInOrigin: {
        user: true,
        walkIn: true,
        VIP: true,
      },
      label: "Room Setup?",
      descriptionHtml: "<p>For reference, please check the <a href=\"https://docs.google.com/document/d/1PQ3LRBFadWp7_IS-A9lAPImHOSKNteCa1-ikaTNOGbU/edit\" target=\"_blank\" rel=\"noopener noreferrer\">103 audience layouts</a>.</p>",
      mode: "radio",
      defaultValue: "103_LAYOUT_0",
      required: true,
      options: [
        {
          value: "103_LAYOUT_0",
          label: "Standing Room (no chairs) - 100 Standing",
        },
        {
          value: "103_LAYOUT_1",
          label: "Audience Layout 1 - 44 Seated",
          chartField: {
            label: "Chartfield",
            descriptionHtml: "",
            required: true,
          },
        },
        {
          value: "103_LAYOUT_2",
          label: "Audience Layout 2 - 50 Seated",
          chartField: {
            label: "Chartfield",
            descriptionHtml: "",
            required: true,
          },
        },
        {
          value: "103_LAYOUT_3",
          label: "Audience Layout 3 - 60 Seated",
          chartField: {
            label: "Chartfield",
            descriptionHtml: "",
            required: true,
          },
        }
      ],
    },
    furnishings: {
      showInOrigin: {
        user: true,
        walkIn: true,
        VIP: true,
      },
      label: "Additional Event Furniture?",
      descriptionHtml: "<p>The following furniture is included with your Garage reservation. See additional event furniture in the room guide. Requesting additional furniture may require hiring CBS through a work order.</p>",
      chartField: {
        label: "Chartfield",
        descriptionHtml: "",
        required: true,
      },
    },
    equipment: {
      showInOrigin: {
        user: true,
        walkIn: true,
        VIP: true,
      },
      label: "Equipment?",
      descriptionHtml: "<p>For DIY reservations, Plug &amp; Play equipment includes: 4x wireless handheld microphones, aux cable for stereo audio playback, video projector + stereo audio playback, Leprecon lighting board with basic wash presets. To request equipment from the Garage inventory, you must request a technician in the Staffing section.</p>",
      showDetailsField: true,
      detailsLabel: "Equipment request details",
    },
    staffing: {
      showInOrigin: {
        user: true,
        walkIn: true,
        VIP: true,
      },
      label: "Staffing?",
      descriptionHtml: "",
      sections: {
        lighting: {
          label: "Lighting",
          descriptionHtml: "",
          mode: "radio",
          defaultValue: "LIGHTING_TECH_DIY",
          options: [
            {
              value: "LIGHTING_TECH_DIY",
              label: "DIY - Basic Washes",
            },
            {
              value: "LIGHTING_TECH_SUPPORT_YOUR_OWN_BOARD",
              label: "Lighting Tech - Support Your Own Board Op",
            },
            {
              value: "LIGHTING_TECH_BUSKING",
              label: "Lighting Tech - Busking",
            },
            {
              value: "LIGHTING_TECH_DESIGN",
              label: "Lighting Tech - Lighting Design",
            }
          ],
        },
        audio: {
          label: "Audio",
          descriptionHtml: "",
          mode: "radio",
          defaultValue: "AUDIO_TECH_DIY",
          options: [
            {
              value: "AUDIO_TECH_DIY",
              label: "DIY - Plug & Play",
            },
            {
              value: "AUDIO_TECH_GENERAL",
              label: "Audio Tech - General House Tech",
            },
            {
              value: "AUDIO_TECH_A1",
              label: "Audio Tech - A1",
            }
          ],
        },
      },
    },
    catering: {
      showInOrigin: {
        user: true,
        walkIn: true,
        VIP: true,
      },
      label: "Catering?",
      descriptionHtml: "",
      chartField: {
        label: "Chartfield",
        descriptionHtml: "",
        required: true,
      },
      forceCleaning: true,
    },
    cleaning: {
      showInOrigin: {
        user: true,
        walkIn: true,
        VIP: true,
      },
      label: "Cleaning?",
      descriptionHtml: "",
      chartField: {
        label: "Chartfield",
        descriptionHtml: "",
        required: true,
      },
    },
    security: {
      showInOrigin: {
        user: true,
        walkIn: true,
        VIP: true,
      },
      label: "Security?",
      descriptionHtml: "",
      mode: "checkbox",
      options: [
        {
          value: "Willoughby Street Entrance",
          label: "I wish to use the Willoughby Street entrance and I understand additional fees will be required to hire a Campus Safety Officer",
          chartField: {
            label: "Chartfield",
            descriptionHtml: "",
            required: true,
          },
        }
      ],
    },
  },
  "202": {
    annex: {
      showInOrigin: {
        user: true,
        walkIn: true,
        VIP: true,
      },
      options: [
        {
          value: "202GR",
          label: "Lecture Green Room",
        },
        {
          value: "205",
          label: "Student Lounge",
        }
      ],
    },
    setup: {
      showInOrigin: {
        user: false,
        walkIn: false,
        VIP: true,
      },
      mode: "radio",
      label: "Room Setup?",
      required: true,
      defaultValue: "202_LAYOUT_0",
      options: [
        {
          value: "202_LAYOUT_0",
          label: "Default layout",
        },
        {
          value: "202_LAYOUT_1",
          label: "Custom layout",
        },
      ],
    },
    furnishings: {
      showInOrigin: {
        user: true,
        walkIn: true,
        VIP: true,
      },
      label: "Additional Event Furniture?",
      descriptionHtml: "<p>See available event furniture in the room guide. Requesting additional furniture may require hiring CBS through a work order.</p>",
      chartField: {
        label: "Chartfield",
        descriptionHtml: "",
        required: true,
      },
    },
    equipment: {
      showInOrigin: {
        user: true,
        walkIn: true,
        VIP: true,
      },
      mode: "static",
      label: "Equipment?",
      descriptionHtml: "<p>202 comes with the following equipment: 190\" LED display, 6 handheld microphones, 2 lavalier microphones, PC with Zoom app. For additional A/V services contact Campus Media. The microphones are located in the AV closet which requires authorized ID card swipe access.</p>",
    },
    catering: {
      showInOrigin: {
        user: true,
        walkIn: true,
        VIP: true,
      },
      mode: "static",
      label: "Catering?",
      descriptionHtml: "<p>Food is not permitted in this room. If your reservation requires catering, you may request to use the student lounge outside of the room. This is only available Friday–Sunday.</p>",
      studentLoungeCheckbox: true,
      forceCleaning: true,
      chartField: {
        label: "Chartfield",
        descriptionHtml: "",
        required: true,
      },
    },
    cleaning: {
      showInOrigin: {
        user: true,
        walkIn: true,
        VIP: true,
      },
      label: "Cleaning?",
      chartField: {
        label: "Chartfield",
        descriptionHtml: "",
        required: true,
      },
    },
    security: {
      showInOrigin: {
        user: true,
        walkIn: true,
        VIP: true,
      },
      label: "Security?",
      chartField: {
        label: "Chartfield",
        descriptionHtml: "",
        required: true,
      },
    },
  },
  "220": {
    setup: {
      showInOrigin: {
        user: false,
        walkIn: true,
        VIP: true,
      },
      label: "Room Setup?",
      descriptionHtml: "",
      mode: "radio",
      defaultValue: "220_LAYOUT_CUSTOM",
      options: [
        {
          value: "220_LAYOUT_CUSTOM",
          label: "Custom Room Setup",
          descriptionHtml: "Please describe the layout in detail.",
          chartField: {
            label: "Chartfield",
            descriptionHtml: "",
            required: true,
          },
        }
      ],
    },
    furnishings: {
      showInOrigin: {
        user: true,
        walkIn: true,
        VIP: true,
      },
      label: "Additional Event Furniture?",
      descriptionHtml: "<p>The following furniture is included with your Black Box reservation: <a href=\"https://sites.google.com/nyu.edu/370jmediacommons/spaces/220-black-box#h.mwvylbk483wu\">Black Box Furniture</a>. See <a href=\"https://sites.google.com/nyu.edu/370jmediacommons/rental-inventory/event-furniture\" target=\"_blank\" rel=\"noopener noreferrer\">additional event furniture here</a>. Please note that requesting additional furniture will require hiring CBS through work order.</p>",
      chartField: {
        label: "Chartfield",
        descriptionHtml: "",
        required: true,
      },
    },
    equipment: {
      showInOrigin: {
        user: true,
        walkIn: true,
        VIP: true,
      },
      label: "Equipment?",
      descriptionHtml: "<p>If you wish to check out equipment, please review <a href=\"https://sites.google.com/nyu.edu/370jmediacommons/rental-inventory\">our equipment inventory</a> and include your request below. Please describe your needs in detail (e.g., 2x Small Mocap Suits).</p>",
    },
    catering: {
      showInOrigin: {
        user: false,
        walkIn: true,
        VIP: true,
      },
      label: "Catering?",
      descriptionHtml: "",
      forceCleaning: true,
      chartField: {
        label: "Chartfield",
        descriptionHtml: "",
        required: true,
      },
    },
    cleaning: {
      showInOrigin: {
        user: false,
        walkIn: true,
        VIP: true,
      },
      label: "Cleaning?",
      descriptionHtml: "",
      chartField: {
        label: "Chartfield",
        descriptionHtml: "",
        required: true,
      },
    },
    security: {
      showInOrigin: {
        user: false,
        walkIn: true,
        VIP: true,
      },
      label: "Security?",
      descriptionHtml: "",
      chartField: {
        label: "Chartfield",
        descriptionHtml: "",
        required: true,
      },
    },
  },
  "221": {
    setup: {
      showInOrigin: {
        user: false,
        walkIn: true,
        VIP: true,
      },
      label: "Room Setup?",
      descriptionHtml: "",
      mode: "radio",
      defaultValue: "221_LAYOUT_CUSTOM",
      options: [
        {
          value: "221_LAYOUT_CUSTOM",
          label: "Custom Room Setup",
          descriptionHtml: "Please describe the layout in detail.",
          chartField: {
            label: "Chartfield",
            descriptionHtml: "",
            required: true,
          },
        }
      ],
    },
    furnishings: {
      showInOrigin: {
        user: true,
        walkIn: true,
        VIP: true,
      },
      label: "Additional Event Furniture?",
      descriptionHtml: "<p>The following furniture is included with your Ballroom reservation: <a href=\"https://sites.google.com/nyu.edu/370jmediacommons/spaces/221-224-ballrooms#h.py4aezgqk1v8\">Ballroom Furniture</a>. See <a href=\"https://sites.google.com/nyu.edu/370jmediacommons/rental-inventory/event-furniture\" target=\"_blank\" rel=\"noopener noreferrer\">additional event furniture here</a>. Please note that requesting additional furniture will require hiring CBS through work order.</p>",
      chartField: {
        label: "Chartfield",
        descriptionHtml: "",
        required: true,
      },
    },
    equipment: {
      showInOrigin: {
        user: true,
        walkIn: true,
        VIP: true,
      },
      label: "Equipment?",
      descriptionHtml: "<p>If you wish to check out equipment, please review <a href=\"https://sites.google.com/nyu.edu/370jmediacommons/rental-inventory\">our equipment inventory</a> and include your request below. Please describe your needs in detail (e.g., 2x Small Mocap Suits).</p>",
    },
    catering: {
      showInOrigin: {
        user: false,
        walkIn: true,
        VIP: true,
      },
      label: "Catering?",
      descriptionHtml: "",
      forceCleaning: true,
      chartField: {
        label: "Chartfield",
        descriptionHtml: "",
        required: true,
      },
    },
    cleaning: {
      showInOrigin: {
        user: false,
        walkIn: true,
        VIP: true,
      },
      label: "Cleaning?",
      descriptionHtml: "",
      chartField: {
        label: "Chartfield",
        descriptionHtml: "",
        required: true,
      },
    },
    security: {
      showInOrigin: {
        user: false,
        walkIn: true,
        VIP: true,
      },
      label: "Security?",
      descriptionHtml: "",
      chartField: {
        label: "Chartfield",
        descriptionHtml: "",
        required: true,
      },
    },
  },
  "222": {
    setup: {
      showInOrigin: {
        user: false,
        walkIn: true,
        VIP: true,
      },
      label: "Room Setup?",
      descriptionHtml: "",
      mode: "radio",
      defaultValue: "222_LAYOUT_CUSTOM",
      options: [
        {
          value: "222_LAYOUT_CUSTOM",
          label: "Custom Room Setup",
          descriptionHtml: "Please describe the layout in detail.",
          chartField: {
            label: "Chartfield",
            descriptionHtml: "",
            required: true,
          },
        }
      ],
    },
    furnishings: {
      showInOrigin: {
        user: true,
        walkIn: true,
        VIP: true,
      },
      label: "Additional Event Furniture?",
      descriptionHtml: "<p>The following furniture is included with your Ballroom reservation: <a href=\"https://sites.google.com/nyu.edu/370jmediacommons/spaces/221-224-ballrooms#h.py4aezgqk1v8\">Ballroom Furniture</a>. See <a href=\"https://sites.google.com/nyu.edu/370jmediacommons/rental-inventory/event-furniture\" target=\"_blank\" rel=\"noopener noreferrer\">additional event furniture here</a>. Please note that requesting additional furniture will require hiring CBS through work order.</p>",
      chartField: {
        label: "Chartfield",
        descriptionHtml: "",
        required: true,
      },
    },
    equipment: {
      showInOrigin: {
        user: true,
        walkIn: true,
        VIP: true,
      },
      label: "Equipment?",
      descriptionHtml: "<p>If you wish to check out equipment, please review <a href=\"https://sites.google.com/nyu.edu/370jmediacommons/rental-inventory\">our equipment inventory</a> and include your request below. Please describe your needs in detail (e.g., 2x Small Mocap Suits).</p>",
    },
    catering: {
      showInOrigin: {
        user: false,
        walkIn: true,
        VIP: true,
      },
      label: "Catering?",
      descriptionHtml: "",
      forceCleaning: true,
      chartField: {
        label: "Chartfield",
        descriptionHtml: "",
        required: true,
      },
    },
    cleaning: {
      showInOrigin: {
        user: false,
        walkIn: true,
        VIP: true,
      },
      label: "Cleaning?",
      descriptionHtml: "",
      chartField: {
        label: "Chartfield",
        descriptionHtml: "",
        required: true,
      },
    },
    security: {
      showInOrigin: {
        user: false,
        walkIn: true,
        VIP: true,
      },
      label: "Security?",
      descriptionHtml: "",
      chartField: {
        label: "Chartfield",
        descriptionHtml: "",
        required: true,
      },
    },
  },
  "223": {
    setup: {
      showInOrigin: {
        user: false,
        walkIn: true,
        VIP: true,
      },
      label: "Room Setup?",
      descriptionHtml: "",
      mode: "radio",
      defaultValue: "223_LAYOUT_CUSTOM",
      options: [
        {
          value: "223_LAYOUT_CUSTOM",
          label: "Custom Room Setup",
          descriptionHtml: "Please describe the layout in detail.",
          chartField: {
            label: "Chartfield",
            descriptionHtml: "",
            required: true,
          },
        }
      ],
    },
    furnishings: {
      showInOrigin: {
        user: true,
        walkIn: true,
        VIP: true,
      },
      label: "Additional Event Furniture?",
      descriptionHtml: "<p>The following furniture is included with your Ballroom reservation: <a href=\"https://sites.google.com/nyu.edu/370jmediacommons/spaces/221-224-ballrooms#h.py4aezgqk1v8\">Ballroom Furniture</a>. See <a href=\"https://sites.google.com/nyu.edu/370jmediacommons/rental-inventory/event-furniture\" target=\"_blank\" rel=\"noopener noreferrer\">additional event furniture here</a>. Please note that requesting additional furniture will require hiring CBS through work order.</p>",
      chartField: {
        label: "Chartfield",
        descriptionHtml: "",
        required: true,
      },
    },
    equipment: {
      showInOrigin: {
        user: true,
        walkIn: true,
        VIP: true,
      },
      label: "Equipment?",
      descriptionHtml: "<p>If you wish to check out equipment, please review <a href=\"https://sites.google.com/nyu.edu/370jmediacommons/rental-inventory\">our equipment inventory</a> and include your request below. Please describe your needs in detail (e.g., 2x Small Mocap Suits).</p>",
    },
    catering: {
      showInOrigin: {
        user: false,
        walkIn: true,
        VIP: true,
      },
      label: "Catering?",
      descriptionHtml: "",
      forceCleaning: true,
      chartField: {
        label: "Chartfield",
        descriptionHtml: "",
        required: true,
      },
    },
    cleaning: {
      showInOrigin: {
        user: false,
        walkIn: true,
        VIP: true,
      },
      label: "Cleaning?",
      descriptionHtml: "",
      chartField: {
        label: "Chartfield",
        descriptionHtml: "",
        required: true,
      },
    },
    security: {
      showInOrigin: {
        user: false,
        walkIn: true,
        VIP: true,
      },
      label: "Security?",
      descriptionHtml: "",
      chartField: {
        label: "Chartfield",
        descriptionHtml: "",
        required: true,
      },
    },
  },
  "224": {
    setup: {
      showInOrigin: {
        user: false,
        walkIn: true,
        VIP: true,
      },
      label: "Room Setup?",
      descriptionHtml: "",
      mode: "radio",
      defaultValue: "224_LAYOUT_CUSTOM",
      options: [
        {
          value: "224_LAYOUT_CUSTOM",
          label: "Custom Room Setup",
          descriptionHtml: "Please describe the layout in detail.",
          chartField: {
            label: "Chartfield",
            descriptionHtml: "",
            required: true,
          },
        }
      ],
    },
    furnishings: {
      showInOrigin: {
        user: true,
        walkIn: true,
        VIP: true,
      },
      label: "Additional Event Furniture?",
      descriptionHtml: "<p>The following furniture is included with your Ballroom reservation: <a href=\"https://sites.google.com/nyu.edu/370jmediacommons/spaces/221-224-ballrooms#h.py4aezgqk1v8\">Ballroom Furniture</a>. See <a href=\"https://sites.google.com/nyu.edu/370jmediacommons/rental-inventory/event-furniture\" target=\"_blank\" rel=\"noopener noreferrer\">additional event furniture here</a>. Please note that requesting additional furniture will require hiring CBS through work order.</p>",
      chartField: {
        label: "Chartfield",
        descriptionHtml: "",
        required: true,
      },
    },
    equipment: {
      showInOrigin: {
        user: true,
        walkIn: true,
        VIP: true,
      },
      label: "Equipment?",
      descriptionHtml: "<p>If you wish to check out equipment, please review <a href=\"https://sites.google.com/nyu.edu/370jmediacommons/rental-inventory\">our equipment inventory</a> and include your request below. Please describe your needs in detail (e.g., 2x Small Mocap Suits).</p>",
    },
    catering: {
      showInOrigin: {
        user: false,
        walkIn: true,
        VIP: true,
      },
      label: "Catering?",
      descriptionHtml: "",
      forceCleaning: true,
      chartField: {
        label: "Chartfield",
        descriptionHtml: "",
        required: true,
      },
    },
    cleaning: {
      showInOrigin: {
        user: false,
        walkIn: true,
        VIP: true,
      },
      label: "Cleaning?",
      descriptionHtml: "",
      chartField: {
        label: "Chartfield",
        descriptionHtml: "",
        required: true,
      },
    },
    security: {
      showInOrigin: {
        user: false,
        walkIn: true,
        VIP: true,
      },
      label: "Security?",
      descriptionHtml: "",
      chartField: {
        label: "Chartfield",
        descriptionHtml: "",
        required: true,
      },
    },
  },
  "230": {
    setup: {
      showInOrigin: {
        user: false,
        walkIn: true,
        VIP: true,
      },
      label: "Room Setup?",
      descriptionHtml: "",
      mode: "radio",
      defaultValue: "230_LAYOUT_CUSTOM",
      options: [
        {
          value: "230_LAYOUT_CUSTOM",
          label: "Custom Room Setup",
          descriptionHtml: "Please describe the layout in detail.",
          chartField: {
            label: "Chartfield",
            descriptionHtml: "",
            required: true,
          },
        }
      ],
    },
    equipment: {
      showInOrigin: {
        user: true,
        walkIn: true,
        VIP: true,
      },
      label: "Equipment?",
      descriptionHtml: "<p>Always available in the SAI Studio: Audio Playback in the Live Room.<br/>Always available for checkout from the front desk: General Media Commons Inventory.<br/>Only available with an Audio Tech staffed: SAI Studio Inventory.</p>",
    },
    catering: {
      showInOrigin: {
        user: false,
        walkIn: true,
        VIP: true,
      },
      label: "Catering?",
      forceCleaning: true,
      chartField: {
        label: "Chartfield",
        descriptionHtml: "",
        required: true,
      },
    },
    cleaning: {
      showInOrigin: {
        user: false,
        walkIn: true,
        VIP: true,
      },
      label: "Cleaning?",
      chartField: {
        label: "Chartfield",
        descriptionHtml: "",
        required: true,
      },
    },
    security: {
      showInOrigin: {
        user: false,
        walkIn: true,
        VIP: true,
      },
      label: "Security?",
      chartField: {
        label: "Chartfield",
        descriptionHtml: "",
        required: true,
      },
    },
  },
  "233": {
    setup: {
      showInOrigin: {
        user: true,
        walkIn: true,
        VIP: true,
      },
      mode: "radio",
      label: "Room Setup?",
      descriptionHtml: "<p>*Options with an asterisk require hiring CBS through work order. Additional layouts may be added when available.</p>",
      required: true,
      defaultValue: "233_LAYOUT_0",
      options: [
        {
          value: "233_LAYOUT_0",
          label: "Classroom Style - 72 Seated",
          chartField: {
            label: "Chartfield",
            descriptionHtml: "",
            required: true,
          },
        },
        {
          value: "233_LAYOUT_1",
          label: "Collaboration Style - 80 Seated",
          chartField: {
            label: "Chartfield",
            descriptionHtml: "",
            required: true,
          },
        },
        {
          value: "233_LAYOUT_2",
          label: "Theater Style - 100 Seated",
          chartField: {
            label: "Chartfield",
            descriptionHtml: "",
            required: true,
          },
        },
        {
          value: "233_LAYOUT_3",
          label: "Empty Room - 100 Standing",
          chartField: {
            label: "Chartfield",
            descriptionHtml: "",
            required: true,
          },
        },
      ],
    },
    furnishings: {
      showInOrigin: {
        user: true,
        walkIn: true,
        VIP: true,
      },
      label: "Additional Event Furniture?",
      descriptionHtml: "<p>See available event furniture in the room guide. Requesting additional furniture may require hiring CBS through a work order.</p>",
      chartField: {
        label: "Chartfield",
        descriptionHtml: "",
        required: true,
      },
    },
    equipment: {
      showInOrigin: {
        user: true,
        walkIn: true,
        VIP: true,
      },
      label: "Equipment?",
      descriptionHtml: "<p>233 comes with a 75\" TV cart, a set of PA speakers on stands. Two wired handheld mics are available by request.</p>",
      showDetailsField: true,
      detailsLabel: "Additional Equipment",
    },
    catering: {
      showInOrigin: {
        user: true,
        walkIn: true,
        VIP: true,
      },
      label: "Catering?",
      forceCleaning: true,
      chartField: {
        label: "Chartfield",
        descriptionHtml: "",
        required: true,
      },
    },
    cleaning: {
      showInOrigin: {
        user: true,
        walkIn: true,
        VIP: true,
      },
      label: "Cleaning?",
      chartField: {
        label: "Chartfield",
        descriptionHtml: "",
        required: true,
      },
    },
    security: {
      showInOrigin: {
        user: true,
        walkIn: true,
        VIP: true,
      },
      label: "Security?",
      chartField: {
        label: "Chartfield",
        descriptionHtml: "",
        required: true,
      },
    },
  },
  "260": {},
  "1201": {
    setup: {
      showInOrigin: {
        user: true,
        walkIn: true,
        VIP: true,
      },
      mode: "radio",
      label: "Room Setup?",
      descriptionHtml: "<p>For reference, please check the <a href=\"https://sites.google.com/nyu.edu/370jmediacommons/1201-public-assembly\" target=\"_blank\" rel=\"noopener noreferrer\">1201 Public Assembly layouts</a>. *Options with an asterisk require hiring CBS through work order.</p>",
      defaultValue: "1201_LAYOUT_0",
      required: true,
      options: [
        {
          value: "1201_LAYOUT_0",
          label: "Lecture Style (Default) - 84 Seated",
        },
        {
          value: "1201_LAYOUT_1",
          label: "Classroom Style - 32 Seated",
          chartField: {
            label: "Chartfield",
            descriptionHtml: "",
            required: true,
          },
        },
        {
          value: "1201_LAYOUT_2",
          label: "Conference Style - 28 Seated",
          chartField: {
            label: "Chartfield",
            descriptionHtml: "",
            required: true,
          },
        },
        {
          value: "1201_LAYOUT_3",
          label: "Workshop Style A - 36 Seated",
          chartField: {
            label: "Chartfield",
            descriptionHtml: "",
            required: true,
          },
        },
        {
          value: "1201_LAYOUT_4",
          label: "Workshop Style B - 56 Seated",
          chartField: {
            label: "Chartfield",
            descriptionHtml: "",
            required: true,
          },
        },
        {
          value: "1201_LAYOUT_5",
          label: "Empty Room - 100 Standing",
          chartField: {
            label: "Chartfield",
            descriptionHtml: "",
            required: true,
          },
        }
      ],
    },
    furnishings: {
      showInOrigin: {
        user: true,
        walkIn: true,
        VIP: true,
      },
      label: "Additional Event Furniture?",
      descriptionHtml: "<p>See available event furniture in the room guide. Requesting additional furniture may require hiring CBS through a work order.</p>",
      chartField: {
        label: "Chartfield",
        descriptionHtml: "",
        required: true,
      },
    },
    equipment: {
      showInOrigin: {
        user: true,
        walkIn: true,
        VIP: true,
      },
      mode: "static",
      label: "Equipment?",
      descriptionHtml: "<p>1201 comes with the following equipment: Projector, Crestron System, 2 handheld mics, 3 lavalier microphones, PC with Zoom app. The microphones are located in a cabinet at the back of the room. For additional A/V services contact Campus Media.</p>",
    },
    catering: {
      showInOrigin: {
        user: true,
        walkIn: true,
        VIP: true,
      },
      label: "Catering?",
      forceCleaning: true,
      chartField: {
        label: "Chartfield",
        descriptionHtml: "",
        required: true,
      },
    },
    cleaning: {
      showInOrigin: {
        user: true,
        walkIn: true,
        VIP: true,
      },
      label: "Cleaning?",
      chartField: {
        label: "Chartfield",
        descriptionHtml: "",
        required: true,
      },
    },
    security: {
      showInOrigin: {
        user: true,
        walkIn: true,
        VIP: true,
      },
      label: "Security?",
      chartField: {
        label: "Chartfield",
        descriptionHtml: "",
        required: true,
      },
    },
    annex: {
      showInOrigin: {
        user: true,
        walkIn: true,
        VIP: true,
      },
      label: "Request breakout space, lounge, or foyer",
      descriptionHtml: "<p>Check if your reservation requires use of breakout space, lounge, or foyer areas.</p>",
    },
  },
};

export function getMcResourceServices(
  resourceId: string,
): ResourceServicesConfig | undefined {
  return MC_SERVICES_BY_ROOM[resourceId];
}

/** Resolve a stored staffing option value to its human-readable label. */
export function getStaffingServiceLabel(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return trimmed;

  for (const services of Object.values(MC_SERVICES_BY_ROOM)) {
    const staffing = services.staffing;
    if (!staffing) continue;

    if (staffing.sections) {
      for (const section of Object.values(staffing.sections)) {
        const fromOptions = section.options?.find((o) => o.value === trimmed);
        if (fromOptions?.label) return fromOptions.label;
        const fromLegacy = section.services?.find((s) => s.value === trimmed);
        if (fromLegacy?.label) return fromLegacy.label;
      }
    }

    const fromFlat = staffing.staffingOptions?.find((s) => s.value === trimmed);
    if (fromFlat?.label) return fromFlat.label;
  }

  return trimmed;
}

/**
 * Setup option values that are informational defaults (no chartfield) and
 * should not count as a "setup service requested" for auto-approval.
 */
export function isMcPassiveSetupDefault(value: string): boolean {
  const normalized = value.trim();
  if (!normalized) return false;
  for (const services of Object.values(MC_SERVICES_BY_ROOM)) {
    const setup = services.setup;
    if (!setup?.defaultValue || setup.defaultValue !== normalized) continue;
    const opt = setup.options?.find((o) => o.value === setup.defaultValue);
    if (opt && !opt.chartField) return true;
  }
  return false;
}

export function applyMcResourceServices(resource: Resource): Resource {
  const mcServices = getMcResourceServices(resource.resourceId);
  if (!mcServices) return resource;

  const { services } = resource;
  // Preserve any object config (including intentional empty `{}`). Legacy
  // string[] services and missing services are replaced by room-specific MC
  // defaults so the schema-driven form can take effect.
  if (services && typeof services === "object" && !Array.isArray(services)) {
    return resource;
  }

  return {
    ...resource,
    services: mcServices,
  };
}
