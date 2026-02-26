import { FormContextLevel } from "@/components/src/types";
// app/edit/role/[id].tsx
import React, { use } from "react";
import UserRolePage from "@/components/src/client/routes/booking/formPages/UserRolePage";

const Role = ({ params }: { params: Promise<{ id: string }> }) => {
  const { id } = use(params);
  return (
    <UserRolePage
      calendarEventId={id}
      formContext={FormContextLevel.EDIT}
    />
  );
};

export default Role;
