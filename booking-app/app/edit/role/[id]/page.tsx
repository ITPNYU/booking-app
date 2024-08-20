// app/edit/role/[id].tsx
import React from "react";
import UserRolePage from "@/components/src/client/routes/booking/formPages/UserRolePage";

const Role: React.FC = ({ params }: { params: { id: string } }) => (
  <UserRolePage calendarEventId={params.id} isEdit={true} />
);

export default Role;
