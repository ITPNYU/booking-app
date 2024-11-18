import { Button } from "@mui/material";
import { PagePermission } from "@/components/src/types";
import useHandleStartBooking from "../../booking/hooks/useHandleStartBooking";
import { useRouter } from "next/navigation";
import { useSharedDatabase } from "../../../providers/SharedDatabaseProvider";

interface Props {
  selectedView: PagePermission;
}

export default function NavBarActionButton({ selectedView }: Props) {
  const { pagePermission } = useSharedDatabase();
  const handleStartBooking = useHandleStartBooking();
  const router = useRouter();

  if (selectedView === PagePermission.BOOKING) {
    return (
      <Button
        onClick={() => {
          handleStartBooking();
          router.push("/media-commons/book");
        }}
        variant="outlined"
        sx={{ height: "40px", marginRight: 2 }}
      >
        Book
      </Button>
    );
  }

  if (pagePermission !== PagePermission.BOOKING) {
    return (
      <Button
        onClick={() => {
          handleStartBooking();
          router.push("/media-commons/walk-in");
        }}
        variant="outlined"
        sx={{ height: "40px", marginRight: 2 }}
      >
        Walk In
      </Button>
    );
  }
}
