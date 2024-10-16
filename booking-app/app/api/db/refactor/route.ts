import { NextRequest, NextResponse } from "next/server";
import {
  serverFetchAllDataFromCollection,
  serverSaveDataToFirestore,
  serverUpdateInFirestore,
} from "@/lib/firebase/server/adminDb";

import { TableNames } from "@/components/src/policy";
import { Timestamp } from "@firebase/firestore";
import { getLoggingClient } from "@/lib/googleClient";

export const dynamic = "force-dynamic";

// DB refactor entrypoint, will call other API endpoints to handle refactor steps
export async function POST(request: NextRequest) {
  let logger;
  try {
    logger = await getLoggingClient();

    // 1. rename usersLiaison to usersApprovers
    const sourceApproverCollection = TableNames.APPROVERS;
    const newApproverCollection = "usersApprovers";
    let res = await fetch(
      process.env.NEXT_PUBLIC_BASE_URL + "/api/db/duplicate",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sourceCollection: sourceApproverCollection,
          newCollection: newApproverCollection,
        }),
      },
    );

    if (!res.ok) {
      let json = await res.json();
      throw new Error(`Error ${res.status}: ${json.error}`);
    } else {
      log(
        logger,
        `Duplicated ${sourceApproverCollection} to ${newApproverCollection}`,
      );
    }

    // 2. every document in usersApprovers needs a numeric approver level
    const rows = await serverFetchAllDataFromCollection(
      newApproverCollection as TableNames,
    );

    await Promise.all(
      rows.map(row =>
        serverUpdateInFirestore(newApproverCollection, row.id, { level: 1 }),
      ),
    );
    log(logger, `Added level field to docs in ${newApproverCollection}`);

    // 3. add finalApproverEmail to usersApprovers collection
    const date = new Date();
    await serverSaveDataToFirestore(newApproverCollection, {
      email: "booking-app-devs+jhanele@itp.nyu.edu",
      level: 2,
      // createdAt: new Timestamp(date.getSeconds(), 0),
    });
    log(logger, `Added final approver doc to ${newApproverCollection}`);

    // 4. rename usersSafetyWhitelist to usersWhitelist
    const sourceWhitelistCollection = TableNames.SAFETY_TRAINING;
    const newWhitelistCollection = "usersWhitelist";
    res = await fetch(process.env.NEXT_PUBLIC_BASE_URL + "/api/db/duplicate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        sourceCollection: sourceWhitelistCollection,
        newCollection: newWhitelistCollection,
      }),
    });

    if (!res.ok) {
      let json = await res.json();
      throw new Error(`Error ${res.status}: ${json.error}`);
    } else {
      log(
        logger,
        `Duplicated ${sourceWhitelistCollection} to ${newWhitelistCollection}`,
      );
    }

    // 5. combine bookings and bookingStatus documents
    const sourceBookingStatus = TableNames.BOOKING_STATUS;
    const destinationBooking = TableNames.BOOKING;
    res = await fetch(process.env.NEXT_PUBLIC_BASE_URL + "/api/db/merge", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        source: sourceBookingStatus,
        destination: destinationBooking,
      }),
    });

    if (!res.ok) {
      let json = await res.json();
      throw new Error(`Error ${res.status}: ${json.error}`);
    } else {
      log(logger, `Merged ${sourceBookingStatus} to ${destinationBooking}`);
    }

    return NextResponse.json({ status: 200 });
  } catch (err) {
    console.error(err);
    log(logger, err);
    return NextResponse.json(
      { error: "Failed to merge collections" },
      { status: 500 },
    );
  }
}

function log(logger, msg) {
  let logEntry = {
    logName: process.env.NEXT_PUBLIC_GCP_LOG_NAME + "/db-refactor",
    resource: { type: "global" },
    entries: [
      {
        jsonPayload: {
          message: msg,
          branchName: process.env.NEXT_PUBLIC_BRANCH_NAME,
        },
        severity: "INFO",
      },
    ],
  };

  logger.entries.write({
    requestBody: logEntry,
  });
}
