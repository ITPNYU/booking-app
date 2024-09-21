import { NextRequest, NextResponse } from "next/server";
import { getGoogleSheet, getLoggingClient } from "@/lib/googleClient";

const SPREADSHEET_ID = process.env.GOOGLE_SPREADSHEET_ID;
const SHEET_GID = process.env.GOOGLE_SHEET_ID;
const COLUMN = "B";
const MAX_ROWS = 1000;

export async function GET(request: NextRequest) {
  try {
    const sheetsService = await getGoogleSheet(SPREADSHEET_ID);
    const logger = await getLoggingClient();

    const spreadsheet = await sheetsService.spreadsheets.get({
      spreadsheetId: SPREADSHEET_ID,
    });

    const sheet = spreadsheet.data.sheets.find(
      s => s.properties.sheetId.toString() === SHEET_GID,
    );
    if (!sheet) {
      throw new Error("Sheet not found");
    }

    const sheetName = sheet.properties.title;

    const range = `${sheetName}!${COLUMN}2:${COLUMN}${MAX_ROWS}`;
    const timestamp = new Date().getTime();

    const response = await sheetsService.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: range,
      fields: "values",
    });
    console.log("emails", response.data.values);

    const logEntry = {
      logName: process.env.NEXT_PUBLIC_GCP_LOG_NAME + "/safety-training",
      resource: { type: "global" },
      entries: [
        {
          jsonPayload: {
            message: "Fetched emails",
            emails: response.data.values,
            number: response.data.values.length,
            branchName: process.env.NEXT_PUBLIC_BRANCH_NAME,
            timestamp,
          },
          severity: "INFO",
        },
      ],
    };

    logger.entries.write({
      requestBody: logEntry,
    });

    const rows = response.data.values;
    if (!rows || rows.length === 0) {
      const res = NextResponse.json({ emails: [] });
      res.headers.set(
        "Cache-Control",
        "no-store, no-cache, must-revalidate, proxy-revalidate",
      );
      res.headers.set("Expires", "0");
      return res;
    }

    const emails = rows
      .flat()
      .filter(email => email && typeof email === "string");

    const res = NextResponse.json({ emails });
    res.headers.set(
      "Cache-Control",
      "no-store, no-cache, must-revalidate, proxy-revalidate",
    );
    res.headers.set("Expires", "0");
    return res;
  } catch (error) {
    console.error("Failed to fetch emails:", error);
    if (
      error.message.includes("insufficient permission") ||
      error.message.includes("access not configured")
    ) {
      console.error(
        "Google Sheets API access is not properly configured. Please check the OAuth scopes.",
      );
    }
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 },
    );
  }
}
