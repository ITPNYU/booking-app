import { Booking } from "../types";
import { Timestamp } from "@firebase/firestore";

function genFakeBookingRow(
  calendarEventId: string,
  email: string,
  fakeData?: any
): Booking {
  const today = new Date();
  const endTime = new Date();
  endTime.setHours(today.getHours() + 4);

  return {
    calendarEventId,
    roomId: "224",
    email,
    startDate: Timestamp.fromDate(today),
    endDate: Timestamp.fromDate(endTime),
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
    catering: "no",
    cateringService: "",
    hireSecurity: "no",
    chartFieldForCatering: "",
    chartFieldForSecurity: "",
    chartFieldForRoomSetup: "",
    devBranch: "development",
    // booking status
    requestedAt: Timestamp.now(),
    requestedBy: email,
    // firstApprovedAt: "",
    // firstApprovedBy: "",
    // finalApprovedAt: "",
    // finalApprovedBy: "",
    // declinedAt: "",
    // declinedBy: "",
    // canceledAt: "",
    // canceledBy: "",
    // checkedInAt: "",
    // checkedInBy: "",
    // checkedOutAt: "",
    // checkedOutBy: "",
    // noShowedAt: "",
    // noShowedBy: "",
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

export function genFakeBooking(n: number, fakeData: any): Booking[] {
  let calendarEventId: string;
  const email = "booking-app-devs@itp.nyu.edu";
  const bookingRows = [];

  for (let i = 0; i < n; i++) {
    calendarEventId = generateUUID();
    bookingRows.push(genFakeBookingRow(calendarEventId, email, fakeData));
  }

  return bookingRows;
}

export function genFakeApprovedBooking(n: number, fakeData: any): Booking[] {
  return genFakeBooking(n, {
    ...fakeData,
    firstApprovedAt: Timestamp.now(),
    firstApprovedBy: "abc123@nyu.edu",
    finalApprovedAt: Timestamp.now(),
    finalApprovedBy: "abc123@nyu.edu",
  });
}
