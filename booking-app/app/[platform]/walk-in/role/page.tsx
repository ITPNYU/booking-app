import { FormContextLevel } from "@/components/src/types";
// app/walk-in/form/page.tsx
import React from "react";
import UserRolePage from "@/components/src/client/routes/booking/formPages/UserRolePage";

const Role: React.FC = () => (
  <UserRolePage formContext={FormContextLevel.WALK_IN} />
);

export default Role;
