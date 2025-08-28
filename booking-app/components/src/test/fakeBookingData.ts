import { Booking, BookingStatus } from "../types";

function genFakeBookingRow(
  calendarEventId: string,
  email: string,
  fakeData?: any
): Booking {
  const today = new Date();
  today.setMinutes(0); // show a nice time
  today.setSeconds(0);
  today.setMilliseconds(0);
  const endTime = new Date();
  endTime.setHours(today.getHours() + 4);
  endTime.setMinutes(0);
  endTime.setSeconds(0);
  endTime.setMilliseconds(0);

  return {
    calendarEventId,
    roomId: "224",
    email,
    startDate: today,
    endDate: endTime,
    firstName: "Grace",
    lastName: "Hopper",
    secondaryName: "",
    nNumber: "N12345678",
    netId: "gh123",
    phoneNumber: "555-123-4567",
    department: "IDM",
    role: "Student",
    sponsorFirstName: "Noah",
    sponsorLastName: "Pivnick",
    sponsorEmail: "nnp278@nyu.edu",
    title: "[Test] My Event",
    description: "This is a fake booking for testing",
    bookingType: "Workshop",
    expectedAttendance: "1",
    attendeeAffiliation: "NYU Members",
    roomSetup: "no",
    setupDetails: "",
    mediaServices: "",
    mediaServicesDetails: "",
    equipmentServices: "",
    equipmentServicesDetails: "",
    staffingServices: "",
    staffingServicesDetails: "",
    catering: "no",
    cateringService: "",
    cleaningService: "no",
    hireSecurity: "no",
    chartFieldForCatering: "",
    chartFieldForCleaning: "",
    chartFieldForSecurity: "",
    chartFieldForRoomSetup: "",
    devBranch: "development",
    ...fakeData,
  };
}

function genFakeBookingStatusRow(
  calendarEventId: string,
  email: string,
  fakeData?: any
): BookingStatus {
  return {
    calendarEventId,
    email,
    requestedAt: new Date(),
    firstApprovedAt: "",
    finalApprovedAt: "",
    declinedAt: "",
    canceledAt: "",
    checkedInAt: "",
    checkedOutAt: "",
    noShowedAt: "",
    ...fakeData,
  };
}

function generateUUID() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
    var r = (Math.random() * 16) | 0,
      v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function addFakeBookingData(
  n: number,
  fakeData: any,
  fakeBookingStatusData: any
) {
  let calendarEventId;
  const email = "booking-app-devs@itp.nyu.edu";
  const bookingRows = [];
  const bookingStatusRows = [];

  for (let i = 0; i < n; i++) {
    calendarEventId = generateUUID();
    bookingRows.push(genFakeBookingRow(calendarEventId, email, fakeData));
  }

  return { bookingRows };
}
