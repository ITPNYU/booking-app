import type {
  Resource,
  ResourceServicesConfig,
} from "@/components/src/client/routes/components/schemaTypes";

/** Default MC resource `services` configs keyed by resourceId (Firestore tenant schema shape). */
const MC_SERVICES_BY_ROOM: Record<string, ResourceServicesConfig> = {
  "103": {
    setup: {
      showInOrigin: {
        user: true,
        walkIn: true,
        VIP: true,
      },
      toggle: "on",
      label: "Room Setup",
      descriptionHtml: "<p>For reference, please check the <a href=\"https://docs.google.com/document/d/1PQ3LRBFadWp7_IS-A9lAPImHOSKNteCa1-ikaTNOGbU/edit\" target=\"_blank\" rel=\"noopener noreferrer\">103 audience layouts</a>. *Options with asterisks require furniture set up and breakdown.</p>",
      mode: "radio",
      defaultValue: "103_LAYOUT_0",
      required: true,
      options: [
        {
          value: "103_LAYOUT_0",
          label: "Standing Room (no chairs) - 91 Standing",
        },
        {
          value: "103_LAYOUT_1",
          label: "Audience Layout 1 - 44 Seated*",
          chartField: {
            label: "ChartField for CBS furniture services",
            descriptionHtml: "",
            required: true,
          },
        },
        {
          value: "103_LAYOUT_2",
          label: "Audience Layout 2 - 50 Seated*",
          chartField: {
            label: "ChartField for CBS furniture services",
            descriptionHtml: "",
            required: true,
          },
        },
        {
          value: "103_LAYOUT_3",
          label: "Audience Layout 3 - 60 Seated*",
          chartField: {
            label: "ChartField for CBS furniture services",
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
      toggle: "optional",
      label: "Furniture",
      descriptionHtml: "<p>The following furniture is included with your Garage reservation: <a href=\"https://sites.google.com/nyu.edu/370jmediacommons/spaces/103-the-garage#h.mncvllnd2iz\" target=\"_blank\" rel=\"noopener noreferrer\">103 Furniture</a>. To request any of these included furniture items, please include them in the Equipment section. To request <b>additional event furniture</b>, select yes and include your request below. <a href=\"https://sites.google.com/nyu.edu/370jmediacommons/rental-inventory/event-furniture#h.wjhawkmv4806\" target=\"_blank\" rel=\"noopener noreferrer\">Event Furniture</a> <i>Requesting additional furniture may require hiring CBS. Chartfield for payment required.</i></p>",
      chartField: {
        label: "Chartfield for CBS furniture services",
        descriptionHtml: "",
        required: true,
      },
      showDetailsField: true,
      detailsLabel: "Additional event furniture request details",
    },
    equipment: {
      showInOrigin: {
        user: true,
        walkIn: true,
        VIP: true,
      },
      toggle: "on",
      label: "Equipment",
      descriptionHtml: "<p>Always available in the Garage: 4x wireless handheld microphones, video projector + stereo audio playback, analog stereo aux input, Leprecon lighting board with basic lighting presets. Always available for checkout from the front desk: <a href=\"https://sites.google.com/nyu.edu/370jmediacommons/rental-inventory\" target=\"_blank\" rel=\"noopener noreferrer\">General Media Commons Inventory</a>. Only available with a Garage Tech staffed for your reservation: <a href=\"https://docs.google.com/spreadsheets/d/1fziyVrzeytQJyZ8585Wtqxer-PBt6L-u-Z0LHVavK5k/edit?gid=870626522#gid=870626522\" target=\"_blank\" rel=\"noopener noreferrer\">Garage Inventory</a>.</p>",
      showDetailsField: true,
      detailsLabel: "Equipment request details",
    },
    staffing: {
      showInOrigin: {
        user: true,
        walkIn: true,
        VIP: true,
      },
      toggle: "on",
      label: "Staffing",
      descriptionHtml: "<p>Please indicate the level of support needed. For more information on the options below, please click here: <a href=\"https://docs.google.com/document/d/16jbnG7iVgtawuHjKi76zZ1yqOm4cBb3rTyLkS_OO4pA/edit?tab=t.0#heading=h.qgdokb6jjtm\" target=\"_blank\" rel=\"noopener noreferrer\">370J Media Commons Staffing Guide. Information on the Plug & Play options can be found here: <a href=\"https://docs.google.com/document/d/1fIv2GCDRAk1DPAPNjlbIEyIYaPbAUz6n7yx1W_Gse24/edit?usp=sharing\" target=\"_blank\" rel=\"noopener noreferrer\">Garage Plug & Play Guide</a>. *If a technician is requested, our staff must confirm their availability prior to the approval of your reservation.</p>",
      sections: {
        lighting: {
          label: "Lighting",
          descriptionHtml: "",
          mode: "radio",
          defaultValue: "LIGHTING_TECH_DIY",
          options: [
            {
              value: "LIGHTING_TECH_DIY",
              label: "No Technician / Plug & Play Lighting",
            },
            {
              value: "LIGHTING_TECH_SUPPORT_YOUR_OWN_BOARD",
              label: "Lighting Tech - Support Your Own Board Op*",
            },
            {
              value: "LIGHTING_TECH_BUSKING",
              label: "Lighting Tech - Busking*",
            },
            {
              value: "LIGHTING_TECH_DESIGN",
              label: "Lighting Tech - Lighting Design*",
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
              label: "No Technician / Plug & Play AV",
            },
            {
              value: "AUDIO_TECH_GENERAL",
              label: "Audio Tech - General House Tech*",
            },
            {
              value: "AUDIO_TECH_A1",
              label: "Audio Tech - A1 Live Sound Engineer*",
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
      toggle: "optional",
      label: "Catering",
      descriptionHtml: "Select yes if you require catering for your event. Chartfield for payment required.",
      chartField: {
        label: "Chartfield for catering services",
        descriptionHtml: "Note - CBS cleaning services are required for catering.",
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
      toggle: "optional",
      label: "Cleaning",
      descriptionHtml: "Select yes if you require cleaning services for your event. Chartfield for payment required.",
      chartField: {
        label: "ChartField for CBS cleaning services",
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
      toggle: "optional",
      label: "Campus Safety",
      descriptionHtml: "If your event requires use of the Willoughby Street entrance, a Campus Safety Officer must be hired for the duration of the event. Please select yes to hire a CSO. Chartfield for payment required.",
      chartField: {
        label: "Chartfield",
        descriptionHtml: "",
        required: true,
      }
    },
  },
  "202": {
    setup: {
      showInOrigin: {
        user: false,
        walkIn: false,
        VIP: true,
      },
      toggle: "optional",
      label: "Room Setup",
      required: true,
      mode: "radio",
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
      toggle: "optional",
      label: "Furniture",
      descriptionHtml: "<p>The 202 Lecture comes included with fixed seating for 210 people and a lectern with AV controls. To request <b>additional event furniture</b>, select yes and include your request below. <a href=\"https://sites.google.com/nyu.edu/370jmediacommons/rental-inventory/event-furniture#h.wjhawkmv4806\" target=\"_blank\" rel=\"noopener noreferrer\">Event Furniture</a>. <i>Requesting additional event furniture may require hiring CBS. Chartfield for payment required.</i></p>",
      chartField: {
        label: "Chartfield for CBS furniture services",
        descriptionHtml: "",
        required: true,
      },
      showDetailsField: true,
      detailsLabel: "Additional event furniture request details",
    },
    equipment: {
      showInOrigin: {
        user: true,
        walkIn: true,
        VIP: true,
      },
      toggle: "off",
      label: "Equipment",
      descriptionHtml: "<p>202 has a Zoom Room AV system with the following equipment available: 190\" LED display, 6 handheld microphones, 2 lavalier microphones, room PC with Zoom. For additional A/V services, please contact <a href=\"https://www.nyu.edu/life/information-technology/computing-support/audio-visual-and-event-services/campus-media-event-support.html\" target=\"_blank\" rel=\"noopener noreferrer\">Campus Media</a>. The microphones are located in the AV closet available only to authorized faculty and staff with ID card swipe access. If you don't have card swipe access, please reach out to <a href=\"mailto:mediacommons.reservations@nyu.edu\">mediacommons.reservations@nyu.edu</a> for assistance.</p>",
    },
    catering: {
      showInOrigin: {
        user: true,
        walkIn: true,
        VIP: true,
      },
      toggle: "off",
      label: "Catering",
      descriptionHtml: "<p><b><u>Food is not permitted inside 202</u></b>. Faculty and staff may request to use the student lounge outside of room 202 where catering is allowed. To do so, please select the nested \"205 Student Lounge\" auxiliary space that appears in the previous calendar page when selecting room 202. Note this is only available Friday-Sunday:</p>",
    },
    cleaning: {
      showInOrigin: {
        user: true,
        walkIn: true,
        VIP: true,
      },
      toggle: "optional",
      label: "Cleaning",
      descriptionHtml: "Select yes if you require cleaning services for your event. Chartfield for payment required.",
      chartField: {
        label: "Chartfield for CBS cleaning services",
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
      toggle: "optional",
      label: "Campus Safety",
      descriptionHtml: "For large events with 75+ attendees. Chartfield for payment required.",
      chartField: {
        label: "Chartfield for Campus Safety services",
        descriptionHtml: "",
        required: true,
      },
    },
  },
  "220": {
    setup: {
      showInOrigin: {
        user: false,
        walkIn: false,
        VIP: true,
      },
      toggle: "optional",
      label: "Room Setup",
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
      toggle: "off",
      label: "Furniture",
      descriptionHtml: "<p>The following furniture is included with your Black Box reservation: <a href=\"https://sites.google.com/nyu.edu/370jmediacommons/spaces/220-black-box#h.mwvylbk483wu\" target=\"_blank\" rel=\"noopener noreferrer\">220 Furniture</a>. Additional event furniture is not available for this production space.</p>",
    },
    equipment: {
      showInOrigin: {
        user: true,
        walkIn: true,
        VIP: true,
      },
      toggle: "optional",
      label: "Equipment",
      descriptionHtml: "<p>To reserve equipment for checkout, select yes and include your request below. Equipment requests are subject to availability. <a href=\"https://sites.google.com/nyu.edu/370jmediacommons/rental-inventory\">Equipment Inventory</a>.</p>",
      showDetailsField: true,
      detailsLabel: "Equipment request details",
      detailsDescriptionHtml: "<p>Describe your needs in detail (e.g., 2x Small Mocap Suits).</p>",
    },
    catering: {
      showInOrigin: {
        user: false,
        walkIn: false,
        VIP: true,
      },
      toggle: "optional",
      label: "Catering",
      descriptionHtml: "Select yes if you require catering for your event. Chartfield for payment required.",
      chartField: {
        label: "Chartfield for catering services",
        descriptionHtml: "Note - CBS cleaning services are required for catering.",
        required: true,
      },
      forceCleaning: true,
    },
    cleaning: {
      showInOrigin: {
        user: false,
        walkIn: true,
        VIP: true,
      },
      toggle: "optional",
      label: "Cleaning",
      descriptionHtml: "Select yes if you require cleaning services for your event. Chartfield for payment required.",
      chartField: {
        label: "ChartField for CBS cleaning services",
        descriptionHtml: "",
        required: true,
      },
    },
    security: {
      showInOrigin: {
        user: false,
        walkIn: false,
        VIP: true,
      },
      toggle: "optional",
      label: "Campus Safety",
      descriptionHtml: "For large events with 75+ attendees. Chartfield for payment required.",
      chartField: {
        label: "Chartfield for Campus Safety services",
        descriptionHtml: "",
        required: true,
      },
    },
  },
  "221": {
    setup: {
      showInOrigin: {
        user: false,
        walkIn: false,
        VIP: true,
      },
      toggle: "optional",
      label: "Room Setup",
      descriptionHtml: "",
      mode: "radio",
      defaultValue: "221_LAYOUT_CUSTOM",
      options: [
        {
          value: "221_LAYOUT_CUSTOM",
          label: "Custom Room Setup",
          descriptionHtml: "Please describe the layout in detail.",
          chartField: {
            label: "Chartfield for CBS furniture services",
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
      toggle: "off",
      label: "Furniture",
      descriptionHtml: "<p>The following furniture is included with your Ballroom reservation: <a href=\"https://sites.google.com/nyu.edu/370jmediacommons/spaces/221-224-ballrooms#h.py4aezgqk1v8\">Ballroom Furniture</a>. Additional event furniture is not available for this production space.</p>",
    },
    equipment: {
      showInOrigin: {
        user: true,
        walkIn: true,
        VIP: true,
      },
      toggle: "optional",
      label: "Equipment",
      descriptionHtml: "<p>To reserve equipment for checkout, select yes and include your request below. Equipment requests are subject to availability. <a href=\"https://sites.google.com/nyu.edu/370jmediacommons/rental-inventory\" target=\"_blank\" rel=\"noopener noreferrer\">Equipment Inventory</a>.</p>",
      showDetailsField: true,
      detailsLabel: "Equipment request details",
      detailsDescriptionHtml: "<p>Describe your needs in detail (e.g., 2x Small Mocap Suits).</p>",
    },
    catering: {
      showInOrigin: {
        user: false,
        walkIn: false,
        VIP: true,
      },
      toggle: "optional",
      label: "Catering",
      descriptionHtml: "Select yes if you require catering for your event. Chartfield for payment required.",
      chartField: {
        label: "Chartfield for catering services",
        descriptionHtml: "Note - CBS cleaning services are required for catering.",
        required: true,
      },
      forceCleaning: true,
    },
    cleaning: {
      showInOrigin: {
        user: true,
        walkIn: false,
        VIP: true,
      },
      toggle: "optional",
      label: "Cleaning",
      descriptionHtml: "Select yes if you require cleaning services for your event. Chartfield for payment required.",
      chartField: {
        label: "Chartfield for CBS cleaning services",
        descriptionHtml: "",
        required: true,
      },
    },
    security: {
      showInOrigin: {
        user: true,
        walkIn: false,
        VIP: true,
      },
      toggle: "optional",
      label: "Campus Safety",
      descriptionHtml: "For large events with 75+ attendees. Chartfield for payment required.",
      chartField: {
        label: "Chartfield for Campus Safety services",
        descriptionHtml: "",
        required: true,
      },
    },
  },
  "222": {
    setup: {
      showInOrigin: {
        user: false,
        walkIn: false,
        VIP: true,
      },
      toggle: "optional",
      label: "Room Setup",
      descriptionHtml: "",
      mode: "radio",
      defaultValue: "222_LAYOUT_CUSTOM",
      options: [
        {
          value: "222_LAYOUT_CUSTOM",
          label: "Custom Room Setup",
          descriptionHtml: "Please describe the layout in detail.",
          chartField: {
            label: "Chartfield for CBS furniture services",
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
      toggle: "off",
      label: "Furniture",
      descriptionHtml: "<p>The following furniture is included with your Ballroom reservation: <a href=\"https://sites.google.com/nyu.edu/370jmediacommons/spaces/221-224-ballrooms#h.py4aezgqk1v8\">Ballroom Furniture</a>. Additional event furniture is not available for this production space.</p>",
    },
    equipment: {
      showInOrigin: {
        user: true,
        walkIn: true,
        VIP: true,
      },
      toggle: "optional",
      label: "Equipment",
      descriptionHtml: "<p>If you wish to check out equipment, please review <a href=\"https://sites.google.com/nyu.edu/370jmediacommons/rental-inventory\">our equipment inventory</a> and include your request below. Please describe your needs in detail (e.g., 2x Small Mocap Suits).</p>",
      showDetailsField: true,
      detailsLabel: "Equipment request details",
      detailsDescriptionHtml: "<p>Describe your needs in detail (e.g., 2x Small Mocap Suits).</p>",
    },
    catering: {
      showInOrigin: {
        user: false,
        walkIn: true,
        VIP: true,
      },
      toggle: "optional",
      label: "Catering",
      descriptionHtml: "Select yes if you require catering for your event. Chartfield for payment required.",
      chartField: {
        label: "Chartfield for catering services",
        descriptionHtml: "Note - CBS cleaning services are required for catering.",
        required: true,
      },
      forceCleaning: true,
    },
    cleaning: {
      showInOrigin: {
        user: false,
        walkIn: true,
        VIP: true,
      },
      toggle: "optional",
      label: "Cleaning",
      descriptionHtml: "Select yes if you require cleaning services for your event. Chartfield for payment required.",
      chartField: {
        label: "Chartfield",
        descriptionHtml: "",
        required: true,
      },
    },
    security: {
      showInOrigin: {
        user: true,
        walkIn: false,
        VIP: true,
      },
      toggle: "optional",
      label: "Campus Safety",
      descriptionHtml: "For large events with 75+ attendees. Chartfield for payment required.",
      chartField: {
        label: "Chartfield for Campus Safety services",
        descriptionHtml: "",
        required: true,
      },
    },
  },
  "223": {
    setup: {
      showInOrigin: {
        user: false,
        walkIn: false,
        VIP: true,
      },
      toggle: "optional",
      label: "Room Setup",
      descriptionHtml: "",
      mode: "radio",
      defaultValue: "223_LAYOUT_CUSTOM",
      options: [
        {
          value: "223_LAYOUT_CUSTOM",
          label: "Custom Room Setup",
          descriptionHtml: "Please describe the layout in detail.",
          chartField: {
            label: "Chartfield for CBS furniture services",
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
      toggle: "off",
      label: "Furniture",
      descriptionHtml: "<p>The following furniture is included with your Ballroom reservation: <a href=\"https://sites.google.com/nyu.edu/370jmediacommons/spaces/221-224-ballrooms#h.py4aezgqk1v8\">Ballroom Furniture</a>. Additional event furniture is not available for this production space.</p>",
    },
    equipment: {
      showInOrigin: {
        user: true,
        walkIn: true,
        VIP: true,
      },
      toggle: "optional",
      label: "Equipment",
      descriptionHtml: "<p>If you wish to check out equipment, please review <a href=\"https://sites.google.com/nyu.edu/370jmediacommons/rental-inventory\">our equipment inventory</a> and include your request below. Please describe your needs in detail (e.g., 2x Small Mocap Suits).</p>",
      showDetailsField: true,
      detailsLabel: "Equipment request details",
      detailsDescriptionHtml: "<p>Describe your needs in detail (e.g., 2x Small Mocap Suits).</p>",
    },
    catering: {
      showInOrigin: {
        user: false,
        walkIn: true,
        VIP: true,
      },
      toggle: "optional",
      label: "Catering",
      descriptionHtml: "Select yes if you require catering for your event. Chartfield for payment required.",
      chartField: {
        label: "Chartfield for catering services",
        descriptionHtml: "Note - CBS cleaning services are required for catering.",
        required: true,
      },
      forceCleaning: true,
    },
    cleaning: {
      showInOrigin: {
        user: false,
        walkIn: true,
        VIP: true,
      },
      toggle: "optional",
      label: "Cleaning",
      descriptionHtml: "Select yes if you require cleaning services for your event. Chartfield for payment required.",
      chartField: {
        label: "Chartfield",
        descriptionHtml: "",
        required: true,
      },
    },
    security: {
      showInOrigin: {
        user: true,
        walkIn: false,
        VIP: true,
      },
      toggle: "optional",
      label: "Campus Safety",
      descriptionHtml: "For large events with 75+ attendees. Chartfield for payment required.",
      chartField: {
        label: "Chartfield for Campus Safety services",
        descriptionHtml: "",
        required: true,
      },
    },
  },
  "224": {
    setup: {
      showInOrigin: {
        user: false,
        walkIn: false,
        VIP: true,
      },
      toggle: "optional",
      label: "Room Setup",
      descriptionHtml: "",
      mode: "radio",
      defaultValue: "224_LAYOUT_CUSTOM",
      options: [
        {
          value: "224_LAYOUT_CUSTOM",
          label: "Custom Room Setup",
          descriptionHtml: "Please describe the layout in detail.",
          chartField: {
            label: "Chartfield for CBS furniture services",
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
      toggle: "off",
      label: "Furniture",
      descriptionHtml: "<p>The following furniture is included with your Ballroom reservation: <a href=\"https://sites.google.com/nyu.edu/370jmediacommons/spaces/221-224-ballrooms#h.py4aezgqk1v8\">Ballroom Furniture</a>. Additional event furniture is not available for this production space.</p>",
    },
    equipment: {
      showInOrigin: {
        user: true,
        walkIn: true,
        VIP: true,
      },
      toggle: "optional",
      label: "Equipment",
      descriptionHtml: "<p>If you wish to check out equipment, please review <a href=\"https://sites.google.com/nyu.edu/370jmediacommons/rental-inventory\">our equipment inventory</a> and include your request below. Please describe your needs in detail (e.g., 2x Small Mocap Suits).</p>",
      showDetailsField: true,
      detailsLabel: "Equipment request details",
      detailsDescriptionHtml: "<p>Describe your needs in detail (e.g., 2x Small Mocap Suits).</p>",
    },
    catering: {
      showInOrigin: {
        user: false,
        walkIn: true,
        VIP: true,
      },
      toggle: "optional",
      label: "Catering",
      descriptionHtml: "Select yes if you require catering for your event. Chartfield for payment required.",
      chartField: {
        label: "Chartfield for catering services",
        descriptionHtml: "Note - CBS cleaning services are required for catering.",
        required: true,
      },
      forceCleaning: true,
    },
    cleaning: {
      showInOrigin: {
        user: false,
        walkIn: true,
        VIP: true,
      },
      toggle: "optional",
      label: "Cleaning",
      descriptionHtml: "Select yes if you require cleaning services for your event. Chartfield for payment required.",
      chartField: {
        label: "Chartfield",
        descriptionHtml: "",
        required: true,
      },
    },
    security: {
      showInOrigin: {
        user: true,
        walkIn: false,
        VIP: true,
      },
      toggle: "optional",
      label: "Campus Safety",
      descriptionHtml: "For large events with 75+ attendees. Chartfield for payment required.",
      chartField: {
        label: "Chartfield for Campus Safety services",
        descriptionHtml: "",
        required: true,
      },
    },
  },
  "230": {
    setup: {
      showInOrigin: {
        user: false,
        walkIn: false,
        VIP: true,
      },
      toggle: "optional",
      label: "Room Setup",
      descriptionHtml: "",
      mode: "radio",
      defaultValue: "230_LAYOUT_CUSTOM",
      options: [
        {
          value: "230_LAYOUT_CUSTOM",
          label: "Custom Room Setup",
          descriptionHtml: "Please describe the layout in detail.",
          chartField: {
            label: "Chartfield for CBS furniture services",
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
      toggle: "on",
      label: "Equipment",
      descriptionHtml: "<p>Always available in the SAI Studio: <a href=\"https://docs.google.com/document/d/121eTGLt8PRbxfTliSYwIQjQ8H4XQj2TwmSmz42AXO1E/edit?usp=sharing\" target=\"_blank\" rel=\"noopener noreferrer\">Audio Playback in the Live Room</a>. Always available for checkout from the front desk: <a href=\"https://sites.google.com/nyu.edu/370jmediacommons/rental-inventory\" target=\"_blank\" rel=\"noopener noreferrer\">General Media Commons Inventory</a>. Only available with an Audio Tech staffed: <a href=\"https://docs.google.com/spreadsheets/d/1XH0B_eZ7h0XlhrjUAOO9RujKzPQQ5VDA4MKCew1UIr4/edit#gid=0\" target=\"_blank\" rel=\"noopener noreferrer\">SAI Studio Inventory</a>.</p>",
      showDetailsField: true,
      detailsLabel: "Equipment request details",
    },
    staffing: {
      showInOrigin: {
        user: true,
        walkIn: true,
        VIP: true,
      },
      toggle: "on",
      label: "Staffing",
      descriptionHtml: "<p>Please indicate the level of support needed. For more information on the options below, please click here: <a href=\"https://docs.google.com/document/d/16jbnG7iVgtawuHjKi76zZ1yqOm4cBb3rTyLkS_OO4pA/edit?tab=t.0#heading=h.qgdokb6jjtm\" target=\"_blank\" rel=\"noopener noreferrer\">370J Media Commons Staffing Guide. Information on the Plug & Play options can be found here: <a href=\"https://docs.google.com/document/d/121eTGLt8PRbxfTliSYwIQjQ8H4XQj2TwmSmz42AXO1E/edit?usp=sharing\" target=\"_blank\" rel=\"noopener noreferrer\">SAI Studio Audio Interface Playback Guide</a>.</p>",
      sections: {
        audio: {
          label: "Audio",
          descriptionHtml: "",
          mode: "radio",
          defaultValue: "AUDIO_TECH_DIY",
          options: [
            {
              value: "AUDIO_TECH_DIY",
              label: "No Technician / Plug & Play AV",
            },
            {
              value: "AUDIO_TECH_GENERAL",
              label: "Audio Tech - General House Tech*",
            },
            {
              value: "AUDIO_TECH_A1",
              label: "Audio Tech - A1 Live Sound Engineer*",
            }
          ],
        },
      },
    },
    catering: {
      showInOrigin: {
        user: false,
        walkIn: false,
        VIP: true,
      },
      toggle: "optional",
      label: "Catering",
      descriptionHtml: "Select yes if you require catering for your event. Chartfield for payment required.",
      chartField: {
        label: "Chartfield for catering services",
        descriptionHtml: "Note - CBS cleaning services are required for catering.",
        required: true,
      },
      forceCleaning: true,
    },
    cleaning: {
      showInOrigin: {
        user: false,
        walkIn: false,
        VIP: true,
      },
      toggle: "optional",
      label: "Cleaning",
      chartField: {
        label: "Chartfield for CBS cleaning services",
        descriptionHtml: "",
        required: true,
      },
    },
    security: {
      showInOrigin: {
        user: false,
        walkIn: false,
        VIP: true,
      },
      toggle: "optional",
      label: "Campus Safety",
      descriptionHtml: "For large events with 75+ attendees. Chartfield for payment required.",
      chartField: {
        label: "Chartfield for Campus Safety services",
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
      toggle: "on",
      label: "Room Setup",
      descriptionHtml: "<p>Each layout style below comes with a set number of tables and chairs. For reference, please see the Public Assembly layouts here: <a href=\"https://docs.google.com/document/d/1NNHu1e_QO3dsY0QpRikT8T3nMsSIWnGc1p3mxrJ2T9Q/edit?usp=sharing\" target=\"_blank\" rel=\"noopener noreferrer\">233 Co-Lab Public Assembly Layouts</a>. *Options with an asterisk require hiring CBS. Chartfield for payment required.</p>",
      mode: "radio",
      required: true,
      defaultValue: "233_LAYOUT_0",
      options: [
        {
          value: "233_LAYOUT_0",
          label: "Classroom Style - 72 Seated",
        },
        {
          value: "233_LAYOUT_1",
          label: "Collaboration Style - 80 Seated*",
          chartField: {
            label: "Chartfield for CBS furniture services",
            descriptionHtml: "",
            required: true,
          },
        },
        {
          value: "233_LAYOUT_2",
          label: "Theater Style - 100 Seated*",
          chartField: {
            label: "Chartfield for CBS furniture services",
            descriptionHtml: "",
            required: true,
          },
        },
        {
          value: "233_LAYOUT_3",
          label: "Empty Room - 100 Standing*",
          chartField: {
            label: "Chartfield for CBS furniture services",
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
      toggle: "optional",
      label: "Furniture",
      descriptionHtml: "<p>The following furniture is included with your Co-Lab reservation: <a href=\"https://sites.google.com/nyu.edu/370jmediacommons/spaces/233-co-lab#h.bxth8sepbu54\" target=\"_blank\" rel=\"noopener noreferrer\">233 Furniture</a>. To request <b>additional event furniture</b>, select yes and include your request below. <a href=\"https://sites.google.com/nyu.edu/370jmediacommons/rental-inventory/event-furniture#h.wjhawkmv4806\" target=\"_blank\" rel=\"noopener noreferrer\">Event Furniture</a>. <i>Requesting additional event furniture may require hiring CBS. Chartfield for payment required.</i></p>",
      chartField: {
        label: "Chartfield for CBS furniture services",
        descriptionHtml: "",
        required: true,
      },
      showDetailsField: true,
      detailsLabel: "Additional event furniture request details",
    },
    equipment: {
      showInOrigin: {
        user: true,
        walkIn: true,
        VIP: true,
      },
      toggle: "optional",
      label: "Equipment",
      descriptionHtml: "<p>The Co-Lab comes included with an 85\" TV cart and a PA with two loudspeakers and a mixer. To reserve additional equipment for checkout, select yes and include your request below. Equipment requests are subject to availability. Equipment Inventory.</p>",
      showDetailsField: true,
      detailsLabel: "Equipment request details",
      detailsDescriptionHtml: "<p>Describe your needs in detail (e.g., 2x SM58 microphones, 2x tripod-base mic stands).</p>",
    },
    catering: {
      showInOrigin: {
        user: true,
        walkIn: false,
        VIP: true,
      },
      toggle: "optional",
      label: "Catering",
      descriptionHtml: "Select yes if you require catering for your event. Chartfield for payment required.",
      chartField: {
        label: "Chartfield for catering services",
        descriptionHtml: "Note - CBS cleaning services are required for catering.",
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
      toggle: "optional",
      label: "Cleaning",
      descriptionHtml: "Select yes if you require cleaning services for your event. Chartfield for payment required.",
      chartField: {
        label: "Chartfield for CBS cleaning services",
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
      toggle: "optional",
      label: "Campus Safety",
      descriptionHtml: "For large events with 75+ attendees. Chartfield for payment required.",
      chartField: {
        label: "Chartfield for Campus Safety services",
        descriptionHtml: "",
        required: true,
      },
    },
  },
  "260": {
    equipment: {
      showInOrigin: {
        user: true,
        walkIn: true,
        VIP: true,
      },
      toggle: "optional",
      label: "Equipment",
      descriptionHtml: "The Post Lab comes included with an 85\” monitor screen. To reserve additional equipment for checkout, select yes and include your request below. Equipment requests are subject to availability. <a href=\"https://sites.google.com/nyu.edu/370jmediacommons/rental-inventory\" target=\"_blank\" rel=\"noopener noreferrer\">Equipment Inventory</a>.",
      showDetailsField: true,
      detailsLabel: "Equipment request details",
      detailsDescriptionHtml: "<p>Describe your needs in detail (e.g., 1x Audio Technica ATH-M50x).</p>",
    }
  },
  "1201": {
    annex: {
      showInOrigin: {
        user: true,
        walkIn: true,
        VIP: true,
      },
      label: "Request breakout space, lounge, or foyer",
      descriptionHtml: "<p>Check if your reservation requires use of breakout space, lounge, or foyer areas.</p>",
      mode: "checkbox",
      options: [
        {
          value: "1200L-6",
          label: "1200L-6 Seminar Foyer",
        },
        {
          value: "1202",
          label: "1202 Seminar Breakout",
        },
        {
          value: "1204",
          label: "1204 Seminar Lounge",
        },
      ],
    },
    setup: {
      showInOrigin: {
        user: true,
        walkIn: true,
        VIP: true,
      },
      toggle: "on",
      label: "Room Setup",
      descriptionHtml: "<p>For reference, please check the <a href=\"https://sites.google.com/nyu.edu/370jmediacommons/1201-public-assembly\" target=\"_blank\" rel=\"noopener noreferrer\">1201 Public Assembly layouts</a>. *Options with an asterisk require hiring CBS through work order.</p>",
      mode: "radio",
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
            label: "Chartfield for CBS furniture services",
            descriptionHtml: "",
            required: true,
          },
        },
        {
          value: "1201_LAYOUT_2",
          label: "Conference Style - 28 Seated",
          chartField: {
            label: "Chartfield for CBS furniture services",
            descriptionHtml: "",
            required: true,
          },
        },
        {
          value: "1201_LAYOUT_3",
          label: "Workshop Style A - 36 Seated",
          chartField: {
            label: "Chartfield for CBS furniture services",
            descriptionHtml: "",
            required: true,
          },
        },
        {
          value: "1201_LAYOUT_4",
          label: "Workshop Style B - 56 Seated",
          chartField: {
            label: "Chartfield for CBS furniture services",
            descriptionHtml: "",
            required: true,
          },
        },
        {
          value: "1201_LAYOUT_5",
          label: "Empty Room - 100 Standing",
          chartField: {
            label: "Chartfield for CBS furniture services",
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
      toggle: "optional",
      label: "Furniture",
      descriptionHtml: "<p>The following furniture is already included with your Seminar Room reservation: <a href=\"https://sites.google.com/nyu.edu/370jmediacommons/spaces/1201-seminar-room#h.ieh9npjizebn\" target=\"_blank\" rel=\"noopener noreferrer\">1201 Furniture</a>. To request additional event furniture, select yes and include your request below. <a href=\"https://sites.google.com/nyu.edu/370jmediacommons/rental-inventory/event-furniture#h.wjhawkmv4806\" target=\"_blank\" rel=\"noopener noreferrer\">Event Furniture</a>. Requesting additional event furniture may require hiring CBS. Chartfield for payment required.</p>",
      chartField: {
        label: "Chartfield for CBS furniture services",
        descriptionHtml: "",
        required: true,
      },
      showDetailsField: true,
      detailsLabel: "Additional event furniture request details",
    },
    equipment: {
      showInOrigin: {
        user: true,
        walkIn: true,
        VIP: true,
      },
      toggle: "off",
      label: "Equipment",
      descriptionHtml: "<p>1201 has a Crestron AV system with the following equipment: 2 Projectors, 2 TV monitors, 2 wireless handheld microphones, 3 wireless lavalier microphones, PC with Zoom. The microphones are located in a cabinet at the back of the room. For additional A/V services, please contact <a href=\"https://www.nyu.edu/life/information-technology/computing-support/audio-visual-and-event-services/campus-media-event-support.html\" target=\"_blank\" rel=\"noopener noreferrer\">Campus Media</a>.</p>",
    },
    catering: {
      showInOrigin: {
        user: true,
        walkIn: false,
        VIP: true,
      },
      toggle: "optional",
      label: "Catering",
      descriptionHtml: "Select yes if you require catering for your event. Chartfield for payment required.",
      chartField: {
        label: "Chartfield for catering services",
        descriptionHtml: "Note - CBS cleaning services are required for catering.",
        required: true,
      },
      forceCleaning: true,
    },
    cleaning: {
      showInOrigin: {
        user: true,
        walkIn: false,
        VIP: true,
      },
      toggle: "optional",
      label: "Cleaning",
      chartField: {
        label: "Chartfield for CBS cleaning services",
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
      toggle: "optional",
      label: "Campus Safety",
      descriptionHtml: "For large events with 75+ attendees. Chartfield for payment required.",
      chartField: {
        label: "Chartfield for Campus Safety services",
        descriptionHtml: "",
        required: true,
      },
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
    if (!setup?.defaultValue) continue;
    const opt = setup.options?.find((o) => o.value === setup.defaultValue);
    if (!opt || opt.chartField) continue;
    if (opt.value === normalized || opt.label === normalized) return true;
  }
  return false;
}

export function applyMcResourceServices(resource: Resource): Resource {
  const mcServices = getMcResourceServices(resource.resourceId);
  if (!mcServices) return resource;

  // This file is the source of truth for MC service configs. The schema
  // editor persists the coerced schema on save, so any `services` object in
  // Firestore is a stale snapshot of this config and is always replaced.
  return {
    ...resource,
    services: mcServices,
  };
}
