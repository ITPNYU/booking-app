import {
  ACTIVE_SHEET_ID,
  ActiveSheetBookingStatusColumns,
  OLD_SAFETY_TRAINING_SHEET_ID,
  OLD_SAFETY_TRAINING_SHEET_NAME,
  TableNames,
} from '../policy';

function formatHeaderString(header: string): string {
  // replace all spaces with underscores
  let snakeCase = header.replace(/ /g, '_');
  // convert snake_case_string to camelCaseString
  let camelCase = snakeCase.replace(/([-_][a-z])/gi, ($1) => {
    return $1.toUpperCase().replace('-', '').replace('_', '');
  });
  // ensure first letter is lowercased
  return camelCase.charAt(0).toLowerCase() + camelCase.slice(1);
}

const sheetToStrings = (rows: any[][] | undefined) =>
  (rows || []).map((row) => row.map((cell) => `${cell}`));

function sheetRowToJSON(headers: string[], row: any[]) {
  const rowObject: any = {};
  headers
    .filter((header) => header.length > 0)
    .forEach((header, index) => {
      rowObject[formatHeaderString(header)] = `${row[index]}`;
    });
  return rowObject;
}

export function sheetToJSON(headers: string[], rows: any[][]): string {
  const jsonArray: string[] = [];
  rows.forEach((row) => {
    const rowObject = sheetRowToJSON(headers, row);
    jsonArray.push(rowObject);
  });
  return JSON.stringify(jsonArray);
}

// always includes header row
const fetchRows_ = (sheetId: string, sheetName: string) => {
  const values = SpreadsheetApp.openById(sheetId)
    .getSheetByName(sheetName)
    .getDataRange()
    .getValues();
  return sheetToStrings(values);
};

export const getAllActiveSheetRows = (sheetName: TableNames) => {
  const rows = fetchRows_(ACTIVE_SHEET_ID, sheetName);
  const headers = rows[0];
  const values = rows.slice(1);
  return sheetToJSON(headers, values);
};

export const getActiveBookingsFutureDates = () => {
  const rows = fetchRows_(ACTIVE_SHEET_ID, TableNames.BOOKING);
  const headers = rows[0];
  const values = rows.slice(1);

  var today = new Date();
  today.setHours(0, 0, 0, 0); // set hours 00:00:00.000

  console.log('VALUES', values);

  var filteredData = values.filter(function (row) {
    var startDate = new Date(row[3]); // 'start date' column
    return startDate > today; // 'start date' is after today
  });

  Logger.log('getFutureDates', filteredData);
  return sheetToJSON(headers, filteredData);
};

export const fetchById = (sheetName: TableNames, id: string) => {
  const rows = fetchRows_(ACTIVE_SHEET_ID, sheetName);
  const row = rows.find((row) => row[0] === id);
  if (!row) throw `Invalid conversation ID: ${id}`;

  const headers = rows[0];
  return sheetRowToJSON(headers, row);
};

export const fetchIndexByUniqueValue = (
  sheetName: string,
  column: number,
  value: string
) => {
  const rowIndex = fetchRows_(ACTIVE_SHEET_ID, sheetName).findIndex(
    (row) => row[column] === value
  );
  if (rowIndex === -1) throw 'Invalid unique value: ' + value;
  return rowIndex;
};

export const fetchIndexById = (sheetName: TableNames, id: string) => {
  return fetchIndexByUniqueValue(
    sheetName,
    ActiveSheetBookingStatusColumns.CALENDAR_ID,
    id
  );
};

// sheet --> row --> column --> new value
export const updateActiveSheetValueById = (
  sheetName: TableNames,
  id: string,
  column: ActiveSheetBookingStatusColumns,
  value: any
) => {
  const rowIndex = fetchIndexById(sheetName, id);
  return SpreadsheetApp.openById(ACTIVE_SHEET_ID)
    .getSheetByName(sheetName)
    .getRange(rowIndex + 1, column + 1)
    .setValue(value);
};

export const getActiveSheetValueById = (
  sheetName: TableNames,
  id: string,
  column: ActiveSheetBookingStatusColumns
) => {
  const rowIndex = fetchIndexById(sheetName, id);
  return SpreadsheetApp.openById(ACTIVE_SHEET_ID)
    .getSheetByName(sheetName)
    .getRange(rowIndex + 1, column + 1)
    .getValue();
};

export const appendRowActive = (sheetName: TableNames, row: any[]) => {
  SpreadsheetApp.openById(ACTIVE_SHEET_ID)
    .getSheetByName(sheetName)
    .appendRow(row);
};

export const removeRowActive = (sheetName: TableNames, rowIndex: number) => {
  SpreadsheetApp.openById(ACTIVE_SHEET_ID)
    .getSheetByName(sheetName)
    .deleteRow(rowIndex + 1);
};

export const getOldSafetyTrainingEmails = () => {
  const activeSpreadSheet = SpreadsheetApp.openById(
    OLD_SAFETY_TRAINING_SHEET_ID
  );
  const activeSheet = activeSpreadSheet.getSheetByName(
    OLD_SAFETY_TRAINING_SHEET_NAME
  );
  var lastRow = activeSheet.getLastRow();

  // get all row3(email) data
  var range = activeSheet.getRange(1, 5, lastRow);
  var values = range.getValues();

  return values;
};
