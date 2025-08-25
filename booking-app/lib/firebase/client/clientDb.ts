import { TableNames } from "@/components/src/policy";
import {
  clientGetDataByCalendarEventId,
  clientUpdateDataInFirestore,
} from "../firebase";

export const clientUpdateDataByCalendarEventId = async (
  collectionName: TableNames,
  calendarEventId: string,
  updatedData: object,
  tenant?: string
) => {
  const data = await clientGetDataByCalendarEventId(
    collectionName,
    calendarEventId,
    tenant
  );

  if (data) {
    const { id } = data;
    await clientUpdateDataInFirestore(collectionName, id, updatedData, tenant);
  } else {
    console.log("No document found with the given calendarEventId.");
  }
};
