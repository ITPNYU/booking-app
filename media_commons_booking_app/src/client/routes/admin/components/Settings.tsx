import React, { useContext } from 'react';

import AddRow from '../../components/AddRow';
import { DatabaseContext } from '../../components/Provider';
import ListTable from '../../components/ListTable';
import { TableNames } from '../../../../policy';
import { formatDate } from '../../../utils/date';

export default function Settings() {
  const { settings, reloadReservationTypes } = useContext(DatabaseContext);

  return (
    <>
      <AddRow
        columnNameToAddValue="reservationType"
        label="Reservation Type"
        tableName={TableNames.RESERVATION_TYPES}
        rows={
          settings.reservationTypes as unknown as { [key: string]: string }[]
        }
        rowsRefresh={reloadReservationTypes}
      />
      <ListTable
        columnNameToRemoveBy="reservationType"
        tableName={TableNames.RESERVATION_TYPES}
        rows={
          settings.reservationTypes as unknown as { [key: string]: string }[]
        }
        rowsRefresh={reloadReservationTypes}
        columnFormatters={{ dateAdded: formatDate }}
      />
    </>
  );
}
