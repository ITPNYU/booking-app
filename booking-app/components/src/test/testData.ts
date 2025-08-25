import { Options } from "yargs";
import { addFakeBookingData } from "./fakeBookingData";
import axios from "axios";
import { hideBin } from "yargs/helpers";
//@ts-ignore
import yargs from "yargs/yargs";

const SERVER_URL = "http://localhost:3001/bookings";

const args = process.argv.slice(2);
const n = parseInt(args[0], 10);

if (isNaN(n)) {
  console.error("Specify how many fake bookings to generate");
  process.exit(1);
}

let fakeData = {};
let fakeBookingStatusData = {};

const options: Record<string, Options> = {
  calendarEventId: { type: "string" },
  roomId: { type: "string" },
  email: { type: "string" },
  startDate: { type: "string" },
  endDate: { type: "string" },
  firstName: { type: "string" },
  lastName: { type: "string" },
  secondaryName: { type: "string" },
  nNumber: { type: "string" },
  netId: { type: "string" },
  phoneNumber: { type: "string" },
  department: { type: "string" },
  role: { type: "string" },
  sponsorFirstName: { type: "string" },
  sponsorLastName: { type: "string" },
  sponsorEmail: { type: "string" },
  title: { type: "string" },
  description: { type: "string" },
  bookingType: { type: "string" },
  expectedAttendance: { type: "string" },
  attendeeAffiliation: { type: "string" },
  roomSetup: { type: "string" },
  setupDetails: { type: "string" },
  mediaServices: { type: "string" },
  mediaServicesDetails: { type: "string" },
  equipmentServices: { type: "string" },
  equipmentServicesDetails: { type: "string" },
  staffingServices: { type: "string" },
  staffingServicesDetails: { type: "string" },
  catering: { type: "string" },
  cateringService: { type: "string" },
  cleaningService: { type: "string" },
  hireSecurity: { type: "string" },
  chartFieldForCatering: { type: "string" },
  chartFieldForCleaning: { type: "string" },
  chartFieldForSecurity: { type: "string" },
  chartFieldForRoomSetup: { type: "string" },
  devBranch: { type: "string" },
  status: { type: "string" },
};

const argv = yargs(hideBin(process.argv))
  .options(options)
  .parserConfiguration({ "camel-case-expansion": false }).argv;

const handleStatus = (status: string) => {
  const date = new Date();
  switch (status) {
    case "finalApproved":
      fakeBookingStatusData["finalApprovedAt"] = date;
    case "firstApproved":
      fakeBookingStatusData["firstApprovedAt"] = date;
      return;
    case "declined":
      fakeBookingStatusData["declinedAt"] = date;
      return;
    case "canceled":
      fakeBookingStatusData["canceledAt"] = date;
      return;
    case "checkedIn":
      fakeBookingStatusData["checkedInAt"] = date;
      return;
    case "noShow":
      fakeBookingStatusData["noShowedAt"] = date;
  }
};

Object.keys(argv).forEach((key) => {
  if (key === "status") {
    handleStatus(argv[key] as string);
  }
  if (
    key != "status" &&
    key !== "_" &&
    key !== "$0" &&
    argv[key] !== undefined
  ) {
    fakeData[key] = argv[key];
  }
});

const data = addFakeBookingData(n, fakeData, fakeBookingStatusData);
axios
  .post(SERVER_URL, data)
  .then((response) => console.log(response.data))
  .catch((error) => console.error(error));

// Usage:
// cd src/test
// start test server: npm run start
// npx tsx testData [number] [any args]
