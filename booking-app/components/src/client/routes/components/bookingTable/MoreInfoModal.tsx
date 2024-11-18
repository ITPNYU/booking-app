import { Alert, Box, Button, Modal, TableCell } from "@mui/material";

import { BookingRow } from "../../../../types";
import { BookingRowMediaCommons } from "@/components/src/typesMediaCommons";
import { BookingRowStaging } from "@/components/src/typesStaging";
import { default as CustomTable } from "../Table";
import { Event } from "@mui/icons-material";
import Grid from "@mui/material/Unstable_Grid2/Grid2";
import { ModalSectionTitle } from "./MoreInfoModalUtil";
import MoreInfoModalMediaCommons from "../../mediaCommons/MoreInfoModalMediaCommons";
import MoreInfoModalStaging from "../../staging/MoreInfoModalStaging";
import { RoomDetails } from "../../booking/components/BookingSelection";
import { Tenants } from "@/components/src/policy";
import { formatTimeAmPm } from "../../../utils/date";
import { styled } from "@mui/system";
import useSortBookingHistory from "../../hooks/useSortBookingHistory";

interface Props {
  booking: BookingRow;
  closeModal: () => void;
  tenant: Tenants;
}

const modalStyle = {
  position: "absolute" as "absolute",
  top: "50%",
  left: "50%",
  transform: "translate(-50%, -50%)",
  height: "90vh",
  width: "600px",
  bgcolor: "background.paper",
  boxShadow: 24,
  display: "grid",
  gridTemplateRows: "1fr 80px",
};

const ScrollableContent = styled(Box)({
  overflowY: "scroll",
});

const Footer = styled(Box)(({ theme }) => ({
  textAlign: "right",
  borderTop: `1px solid ${theme.palette.custom.border}`,
}));

const StatusTable = styled(CustomTable)({
  width: "100%",
});

const AlertHeader = styled(Alert)(({ theme }) => ({
  background: theme.palette.secondary.light,

  ".MuiAlert-icon": {
    color: theme.palette.primary.main,
  },
}));

export default function MoreInfoModal({ booking, closeModal, tenant }: Props) {
  const historyRows = useSortBookingHistory(booking);

  const historyCols = [
    <TableCell key="status">Status</TableCell>,
    <TableCell key="user">User</TableCell>,
    <TableCell key="date">Date</TableCell>,
    <TableCell key="note">Note</TableCell>,
  ];

  const content = (() => {
    switch (tenant) {
      case Tenants.MEDIA_COMMONS:
        return (
          <MoreInfoModalMediaCommons
            booking={booking as BookingRowMediaCommons}
          />
        );
      case Tenants.STAGING:
        return <MoreInfoModalStaging booking={booking as BookingRowStaging} />;
    }
  })();

  return (
    <Modal open={booking != null} onClose={closeModal}>
      <Box sx={modalStyle}>
        <ScrollableContent padding={4}>
          <AlertHeader color="info" icon={<Event />} sx={{ marginBottom: 3 }}>
            <RoomDetails container>
              <label>Request Number:</label>
              <p>{booking.requestNumber ?? "--"}</p>
            </RoomDetails>
            <RoomDetails container>
              <label>Rooms:</label>
              <p>{booking.roomId}</p>
            </RoomDetails>
            <RoomDetails container>
              <label>Date:</label>
              <p>{booking.startDate.toDate().toLocaleDateString()}</p>
            </RoomDetails>
            <RoomDetails container>
              <label>Time:</label>
              <p>{`${formatTimeAmPm(booking.startDate.toDate())} - ${formatTimeAmPm(
                booking.endDate.toDate()
              )}`}</p>
            </RoomDetails>
            <RoomDetails container>
              <label>Status:</label>
              <p>{booking.status}</p>
            </RoomDetails>
          </AlertHeader>
          <Grid container columnSpacing={2} margin={0}>
            <ModalSectionTitle>History</ModalSectionTitle>
            <StatusTable columns={historyCols} sx={{ marginBottom: 3 }}>
              {historyRows}
            </StatusTable>
            {content}
          </Grid>
        </ScrollableContent>

        <Footer pr={4} pt={2}>
          <Button variant="text" onClick={closeModal}>
            Close
          </Button>
        </Footer>
      </Box>
    </Modal>
  );
}
