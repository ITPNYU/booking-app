import { Button } from "@mui/material";
import { PagePermission } from "@/components/src/types";
import { Tenants } from "@/components/src/policy";
import useHandleStartBooking from "../../booking/hooks/useHandleStartBooking";
import { useRouter } from "next/navigation";
import { useSharedDatabase } from "../../../providers/SharedDatabaseProvider";
import useTenant from "../../../utils/useTenant";

interface Props {
  selectedView: PagePermission;
}

export default function NavBarActionButton({ selectedView }: Props) {
  const { pagePermission } = useSharedDatabase();
  const tenant = useTenant();
  const handleStartBooking = useHandleStartBooking();
  const router = useRouter();

  if (selectedView === PagePermission.BOOKING) {
    return (
      <Button
        onClick={handleStartBooking}
        variant="outlined"
        sx={{ height: "40px", marginRight: 2 }}
      >
        Book
      </Button>
    );
  }

  if (
    tenant === Tenants.MEDIA_COMMONS &&
    pagePermission !== PagePermission.BOOKING
  ) {
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
