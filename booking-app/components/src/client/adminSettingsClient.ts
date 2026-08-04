import { ApproverLevel, TableNames } from "@/components/src/policy";
import { Approver, Days, OperationHours } from "@/components/src/types";
import {
  clientFetchAllDataFromCollection,
  clientSaveDataToFirestore,
  clientUpdateDataInFirestore,
} from "@/lib/firebase/firebase";

export const updateFinalApprover = async (updatedData: object) => {
  type ApproverDoc = Approver & { id: string };
  const approverDocs = await clientFetchAllDataFromCollection<ApproverDoc>(
    TableNames.APPROVERS,
  );

  if (approverDocs.length > 0) {
    const finalApproverDoc = approverDocs.filter(
      (doc) => doc.level === ApproverLevel.FINAL,
    )[0];
    const docId = finalApproverDoc.id;
    await clientUpdateDataInFirestore(TableNames.APPROVERS, docId, updatedData);
  } else {
    console.log("No policy settings docs found");
  }
};

export const updateOperationHours = async (
  day: Days,
  open: number,
  close: number,
  isClosed: boolean,
  roomId?: string | number,
) => {
  const docs = await clientFetchAllDataFromCollection<
    OperationHours & { id: string }
  >(TableNames.OPERATION_HOURS);

  const normalizedRoomId =
    roomId === undefined || roomId === null ? undefined : String(roomId);
  const match = docs.find((x) => {
    if (normalizedRoomId) {
      return x.day === day && String(x.roomId) === normalizedRoomId;
    }
    return x.day === day;
  });

  if (match != null) {
    const { id, ...data } = match;
    clientUpdateDataInFirestore(TableNames.OPERATION_HOURS, match.id, {
      ...data,
      open,
      close,
      isClosed,
    });
  } else {
    const r = normalizedRoomId ? { roomId: normalizedRoomId } : {};
    clientSaveDataToFirestore(TableNames.OPERATION_HOURS, {
      day,
      open,
      close,
      isClosed,
      ...r,
    });
  }
};
