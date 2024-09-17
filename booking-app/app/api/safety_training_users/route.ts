import { getGoogleSheet } from "@/lib/googleClient";
import { NextRequest, NextResponse } from "next/server";

const SPREADSHEET_ID = process.env.GOOGLE_SPREADSHEET_ID;
const SHEET_GID = process.env.GOOGLE_SHEET_ID;
const COLUMN = "B";
const MAX_ROWS = 1000;

export async function GET(request: NextRequest) {
  try {
    const sheetsService = await getGoogleSheet(SPREADSHEET_ID);

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

    const rows = response.data.values;
    if (!rows || rows.length === 0) {
      return NextResponse.json({ emails: [] });
    }

    const emails = rows
      .flat()
      .filter(email => email && typeof email === "string");

    return NextResponse.json({ emails });
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
