import React, { useContext, useMemo } from "react";

import AddRow from "../../components/AddRow";
import { DatabaseContext } from "../../components/Provider";
import ListTable from "../../components/ListTable";
import { TableNames } from "../../../../policy";
import { formatDate } from "../../../utils/date";

export default function BookingTypes() {
  const { settings, reloadBookingTypes } = useContext(DatabaseContext);

  const addResType = useMemo(
    () => (
      <AddRow
        columnNameUniqueValue="bookingType"
        tableName={TableNames.BOOKING_TYPES}
        rows={settings.bookingTypes as unknown as { [key: string]: string }[]}
        rowsRefresh={reloadBookingTypes}
        inputPlaceholder="Add booking type"
        title="Booking Form Booking Types"
      />
    ),
    [settings.bookingTypes, reloadBookingTypes]
  );

  const rows = useMemo(() => {
    const sorted = settings.bookingTypes.sort((a, b) =>
      a.bookingType.localeCompare(b.bookingType)
    );
    return sorted as unknown as { [key: string]: string }[];
  }, [settings.bookingTypes]);

  return (
    <ListTable
      columnNameToRemoveBy="bookingType"
      tableName={TableNames.BOOKING_TYPES}
      rows={rows}
      rowsRefresh={reloadBookingTypes}
      columnFormatters={{ createdAt: formatDate }}
      topRow={addResType}
    />
  );
}
