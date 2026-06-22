import { Stack, Typography } from "@mui/material";
import { EquipmentUsers } from "./EquipmentUsers";
import { Liaisons } from "./Liaisons";
import { ResourceSpecific } from "./ResourceSpecific";
import { ServiceApproverUsers } from "./ServiceApproverUsers";

export const Approvers = () => (
  <div>
    <Typography style={{ marginBottom: 24 }} variant="h6">
      Liaison Users
    </Typography>
    <Liaisons />
    <Typography style={{ marginTop: 48, marginBottom: 24 }} variant="h6">
      Equipment Users
    </Typography>
    <EquipmentUsers />
    <Typography style={{ marginTop: 48, marginBottom: 24 }} variant="h6">
      Resource Approvers
    </Typography>
    <ResourceSpecific />
    <Typography style={{ marginTop: 48, marginBottom: 24 }} variant="h6">
      Service Approvers
    </Typography>
    <Stack spacing={4}>
      <ServiceApproverUsers title="Setup Approvers" service="setup" />
      <ServiceApproverUsers title="Equipment Approvers" service="equipment" />
      <ServiceApproverUsers title="Staffing Approvers" service="staff" />
      <ServiceApproverUsers title="Catering Approvers" service="catering" />
      <ServiceApproverUsers title="Cleanup Approvers" service="cleaning" />
      <ServiceApproverUsers title="Security Approvers" service="security" />
    </Stack>
  </div>
);
