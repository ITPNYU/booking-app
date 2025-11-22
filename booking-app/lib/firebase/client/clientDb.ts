import { TableNames } from "@/components/src/policy";
import {
  clientGetDataByCalendarEventId,
  clientUpdateDataInFirestore,
} from "../firebase";

export const clientUpdateDataByCalendarEventId = async (
  collectionName: TableNames,
  calendarEventId: string,
  updatedData: object
) => {
  const data = await clientGetDataByCalendarEventId(
    collectionName,
    calendarEventId
  );

  if (data) {
    const { id } = data;
    await clientUpdateDataInFirestore(collectionName, id, updatedData);
  } else {
    console.log("No document found with the given calendarEventId.");
  }
};
