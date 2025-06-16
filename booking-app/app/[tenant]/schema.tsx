import SVGLOGO from "../../public/mediaCommonsLogo.svg";
import { SchemaContextType } from "@/components/src/client/routes/components/SchemaProvider";

export const schema: Record<string, SchemaContextType> = {
  mc: {
    name: "Media Commons",
    logo: SVGLOGO,
    nameForPolicy: "370J Media Commons",
    supportVIP: true,
    supportWalkIn: true,
    resourceName: "Room(s)",
    policy: `
    <p style="font-weight: 700; font-size: 1rem; line-height: 1.5; margin-top: 24px;">
      Booking Confirmation
    </p>
    <p style="font-size: 1rem; line-height: 1.5;">
      You will receive an email response from the Media Commons Team and a
      calendar invite once your request has been reviewed and processed.
      Please allow a minimum of 3 days for your request to be approved. If
      you do not hear back about your request, please contact the Media
      Commons Team (
      <a href="mailto:mediacommons.reservations@nyu.edu">
        mediacommons.reservations@nyu.edu
      </a>
      ) to follow up. A request does not guarantee a booking.
    </p>
    <p style="font-weight: 700; font-size: 1rem; line-height: 1.5; margin-top: 24px;">
      Cancellation Policy
    </p>
    <p style="font-size: 1rem; line-height: 1.5;">
      To cancel a reservation please email the Media Commons Team (
      <a href="mailto:mediacommons.reservations@nyu.edu">
        mediacommons.reservations@nyu.edu
      </a>
      ) at least 24 hours before the date of the event. Failure to cancel
      may result in restricted use of the Media Commons.
    </p>`,
    programs: [
      "ALT",
      "CDI",
      "Game Center",
      "IDM",
      "ITP / IMA / Low Res",
      "MARL",
      "MPAP",
      "Music Tech",
      "Other",
    ],
    roles: [
      "Student",
      "Resident/Fellow",
      "Faculty",
      "Admin/Staff",
      "Chair/Program Director",
    ],
    roleMapping: {
      Student: ["STUDENT", "DEGREE"],
      "Resident/Fellow": ["FELLOW", "RESIDENT", "POST DOCTORAL FELLOW"],
      Faculty: ["FACULTY", "PROFESSOR", "ADJUNCT FACULTY", "LECTURER"],
      "Admin/Staff": ["ADMINISTRATOR", "STAFF", "EMPLOYEE"],
      "Chair/Program Director": ["CHAIR", "PROGRAM DIRECTOR"],
    },
    programMapping: {
      ALT: ["ALT"],
      CDI: ["CDI"],
      "Game Center": ["GAMES", "GAMECENTER"],
      IDM: ["IDM"],
      "ITP / IMA / Low Res": ["ITP", "IMA", "LOWRES"],
      MARL: ["MARL"],
      MPAP: ["MPAP", "PERFORMINGARTS"],
      "Music Tech": ["MUSICTECH", "MUSTECH"],
      Other: [],
    },
    resources: [
      {
        roomId: 221,
        name: "Ballroom A",
        capacity: 12,
        autoApproval: true,
        checkable: false,
      },
      {
        roomId: 222,
        name: "Ballroom B",
        capacity: 12,
        autoApproval: true,
        checkable: false,
      },
      {
        roomId: 223,
        name: "Ballroom C",
        capacity: 12,
        autoApproval: true,
        checkable: false,
      },
      {
        roomId: 224,
        name: "Ballroom D",
        capacity: 12,
        autoApproval: true,
        checkable: false,
      },
      {
        roomId: 202,
        name: "Lecture Hall",
        capacity: 210,
        autoApproval: true,
        checkable: false,
      },
      {
        roomId: 230,
        name: "Audio Lab",
        capacity: 13,
        autoApproval: true,
        checkable: false,
      },
      {
        roomId: 103,
        name: "The Garage",
        capacity: 74,
        autoApproval: true,
        checkable: false,
      },
      {
        roomId: 260,
        name: "Post Production Lab",
        capacity: 20,
        autoApproval: true,
        checkable: false,
      },
      {
        roomId: 233,
        name: "Co-Lab",
        capacity: 50,
        autoApproval: true,
        checkable: false,
      },
      {
        roomId: 1201,
        name: "Seminar Room",
        capacity: 100,
        autoApproval: true,
        checkable: false,
      },
      {
        roomId: 220,
        name: "Black Box",
        capacity: 30,
        autoApproval: true,
        checkable: false,
      },
    ],
    showNNumber: true,
    showSponsor: true,
    showHireSecurity: true,
    agreements: [
      {
        id: "checklist",
        html: `<p>
                I confirm receipt of the
                <a
                  href="https://docs.google.com/document/d/1TIOl8f8-7o2BdjHxHYIYELSb4oc8QZMj1aSfaENWjR8/edit#heading=h.ns3jisyhutvq"
                  target="_blank"
                  className="text-blue-600 hover:underline dark:text-blue-500 mx-1 mx-1"
                >
                  370J Media Commons Event Service Rates/Additional Information
                </a>
                document that contains information regarding event needs and
                services. I acknowledge that it is my responsibility to set up
                catering and Campus Media if needed for my reservation. I
                understand that the 370J Media Commons Operations staff will
                setup CBS cleaning services, facilitate hiring security, and
                arrange room setup services if needed for my reservation.
              </p>`,
      },
      {
        id: "resetRoom",
        html: `<p>
                I agree to reset all rooms and common spaces I have used to
                their original state at the end of my reservation, including
                returning equipment, resetting furniture, and cleaning up after
                myself. I will notify Media Commons staff of any problems,
                damage, or other concerns affecting the condition and
                maintenance of the reserved space. I understand that if I do not
                reset the room, I may lose access to the Media Commons.
              </p>`,
      },
      {
        id: "bookingPolicy",
        html: `<p>
                I have read the
                <a
                  href="https://docs.google.com/document/d/1vAajz6XRV0EUXaMrLivP_yDq_LyY43BvxOqlH-oNacc/edit"
                  target="_blank"
                  className="text-blue-600 hover:underline dark:text-blue-500 mx-1 mx-1"
                >
                  Booking Policy for 370J Media Commons
                </a>
                and agree to follow all policies outlined. I understand that I
                may lose access to the Media Commons if I break this agreement.
              </p>`,
      },
    ],
  },
  itp: {
    name: "ITP",
    supportVIP: false,
    supportWalkIn: false,
    logo: SVGLOGO,
    nameForPolicy: "ITP",
    resourceName: "Resource(s)",
    policy: "<p>ITP Policy</p>",
    programs: ["ALT"],
    roles: ["Student"],
    roleMapping: {
      Student: ["STUDENT", "DEGREE"],
    },
    programMapping: {
      ALT: ["ALT"],
    },
    resources: [
      {
        roomId: 221,
        name: "Ballroom A",
        capacity: 12,
        autoApproval: true,
        checkable: false,
      },
    ],
    showNNumber: false,
    showSponsor: false,
    showHireSecurity: false,
    agreements: [
      {
        id: "bookingPolicy",
        html: `<p>ITP Policy</p>`,
      },
    ],
  },
};
