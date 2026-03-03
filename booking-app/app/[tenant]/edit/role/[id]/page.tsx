"use client";

import { FormContextLevel } from "@/components/src/types";
// app/edit/role/[id].tsx
import React from "react";
import UserRolePage from "@/components/src/client/routes/booking/formPages/UserRolePage";

const Role = ({ params }: { params: { id: string } }) => {
  const { id } = params;
  return (
    <UserRolePage
      calendarEventId={id}
      formContext={FormContextLevel.EDIT}
    />
  );
};

export default Role;
