import {
  ACTIVE_SHEET_ID,
  ActiveSheetBookingStatusColumns,
  OLD_SAFETY_TRAINING_SHEET_ID,
  OLD_SAFETY_TRAINING_SHEET_NAME,
  TableNames,
} from '../policy';

const sheetToStrings = (rows: any[][] | undefined) =>
  (rows || []).map((row) => row.map((cell) => `${cell}`));

const fetchRows_ = (
  sheetId: string,
  sheetName: string,
  includeHeaders: boolean = false
) => {
  const values = SpreadsheetApp.openById(sheetId)
    .getSheetByName(sheetName)
    .getDataRange()
    .getValues()
    .slice(includeHeaders ? 0 : 1); // potentially ignore the header row
  return sheetToStrings(values);
};

export const getAllActiveSheetRows = (sheetName: TableNames) =>
  fetchRows_(ACTIVE_SHEET_ID, sheetName);

export const getActiveBookingsFutureDates = () => {
  const values = fetchRows_(ACTIVE_SHEET_ID, TableNames.BOOKING);

  var today = new Date();
  today.setHours(0, 0, 0, 0); // set hours 00:00:00.000

  var filteredData = values.filter(function (row, index) {
    var startDate = new Date(row[3]); // 'start date' column
    return startDate > today; // 'start date' is after today
  });

  Logger.log('getFutureDates', filteredData);
  return filteredData;
};

// TODO FIX ME headValues ?
export const fetchById = (sheetName: TableNames, id: string) => {
  const row = fetchRows_(ACTIVE_SHEET_ID, sheetName).find(
    (row) => row[0] === id
  );
  if (!row) throw `Invalid conversation ID: ${id}`;
  // const messages = row.flatMap((row) => {
  //   const dataObj = {};
  //   // headValues.forEach((head, cnt) => {
  //   //   dataObj[head] = row[cnt];
  //   // });
  //   return dataObj;
  // });
  return row;
};

export const fetchIndexByUniqueValue = (
  sheetName: string,
  column: number,
  value: string
) => {
  const rowIndex = fetchRows_(ACTIVE_SHEET_ID, sheetName, true).findIndex(
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
