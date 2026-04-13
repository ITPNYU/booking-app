import { Stack, Typography } from "@mui/material";
import { EquipmentUsers } from "./EquipmentUsers";
import { Liaisons } from "./Liaisons";
import { ResourceApprovers } from "./ResourceApprovers";
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
      Service Approvers
    </Typography>
    <Stack spacing={4}>
      <ServiceApproverUsers title="Setup Approvers" flagField="isSetup" />
      <ServiceApproverUsers title="Equipment Approvers" flagField="isEquipment" />
      <ServiceApproverUsers title="Staffing Approvers" flagField="isStaffing" />
      <ServiceApproverUsers title="Catering Approvers" flagField="isCatering" />
      <ServiceApproverUsers title="Cleanup Approvers" flagField="isCleaning" />
      <ServiceApproverUsers title="Security Approvers" flagField="isSecurity" />
    </Stack>
    <Typography style={{ marginTop: 48, marginBottom: 8 }} variant="h6">
      Final Approvers per Resource
    </Typography>
    <Typography variant="body2" color="text.secondary" style={{ marginBottom: 16 }}>
      Assign a dedicated final approver for each resource. When set, this
      address overrides the tenant-level final approver for bookings of that
      resource.
    </Typography>
    <ResourceApprovers />
  </div>
);
