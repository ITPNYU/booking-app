import React, { useContext, useMemo } from "react";

import AddRow from "../../components/AddRow";
import ListTable from "../../components/ListTable";
import { SharedDatabaseContext } from "../../../providers/SharedDatabaseProvider";
import { TableNamesMediaCommonsOnly } from "@/components/src/mediaCommonsPolicy";
import { formatDate } from "../../../utils/date";

export default function BookingTypes() {
  const { settings, reloadBookingTypes } = useContext(SharedDatabaseContext);

  const addResType = useMemo(
    () => (
      <AddRow
        columnNameUniqueValue="bookingType"
        tableName={TableNamesMediaCommonsOnly.BOOKING_TYPES}
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
      tableName={TableNamesMediaCommonsOnly.BOOKING_TYPES}
      rows={rows}
      rowsRefresh={reloadBookingTypes}
      columnFormatters={{ createdAt: formatDate }}
      topRow={addResType}
    />
  );
}
