"use client";

import { FormContextLevel } from "@/components/src/types";
// app/edit/role/[id].tsx
import { useParams } from "next/navigation";
import React from "react";
import UserRolePage from "@/components/src/client/routes/booking/formPages/UserRolePage";

const Role = () => {
  const { id } = useParams<{ id: string }>();
  return (
    <UserRolePage
      calendarEventId={id}
      formContext={FormContextLevel.EDIT}
    />
  );
};

export default Role;
