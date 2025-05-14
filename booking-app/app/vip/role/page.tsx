import React from "react";
// app/book/form/page.tsx
import UserRolePage from "@/components/src/client/routes/booking/formPages/UserRolePage";
import { FormContextLevel } from "@/components/src/types";

const Role: React.FC = () => (
  <UserRolePage formContext={FormContextLevel.VIP} />
);

export default Role;
