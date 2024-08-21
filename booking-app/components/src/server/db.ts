import { Timestamp, where } from "@firebase/firestore";

import { TableNames } from "../policy";
import { fetchAllDataFromCollection } from "@/lib/firebase/firebase";

export const fetchAllFutureBooking = async <T>(
  collectionName: TableNames
): Promise<T[]> => {
  const now = Timestamp.now();
  const futureQueryConstraints = [where("endDate", ">", now)];
  return fetchAllDataFromCollection<T>(collectionName, futureQueryConstraints);
};

export const fetchAllFutureBookingStatus = async <T>(
  collectionName: TableNames
): Promise<T[]> => {
  // const now = Timestamp.now();
  // const futureQueryConstraints = [where("requestedAt", ">", now)];
  return fetchAllDataFromCollection<T>(collectionName);
};

export const getOldSafetyTrainingEmails = () => {
  //TODO: implement this
  return [];
  //const activeSpreadSheet = SpreadsheetApp.openById(
  //  OLD_SAFETY_TRAINING_SHEET_ID
  //);
  //const activeSheet = activeSpreadSheet.getSheetByName(
  //  OLD_SAFETY_TRAINING_SHEET_NAME
  //);
  //var lastRow = activeSheet.getLastRow();

  //// get all row3(email) data
  //var range = activeSheet.getRange(1, 5, lastRow);
  //var values = range.getValues();

  //const secondSpreadSheet = SpreadsheetApp.openById(
  //  SECOND_OLD_SAFETY_TRAINING_SHEET_ID
  //);
  //const secondSheet = secondSpreadSheet
  //  .getSheets()
  //  .find(
  //    (sheet) => sheet.getSheetId() === SECOND_OLD_SAFETY_TRAINING_SHEET_GID
  //  );
  //const secondLastRow = secondSheet.getLastRow();
  //const secondRange = secondSheet.getRange(1, 2, secondLastRow);
  //const secondValues = secondRange.getValues();

  //const combinedValues = [...values, ...secondValues];
  //return combinedValues;
};

export const approvers = async () => {
  const fetchedData = await fetchAllDataFromCollection(TableNames.APPROVERS);
  const filtered = fetchedData.map((item: any) => ({
    id: item.id,
    email: item.email,
    department: item.department,
    createdAt: item.createdAt,
  }));
  return filtered;
};

export const firstApproverEmails = async (department: string) => {
  const approversData = await approvers();
  return approversData
    .filter((approver) => approver.department === department)
    .map((approver) => approver.email);
};
