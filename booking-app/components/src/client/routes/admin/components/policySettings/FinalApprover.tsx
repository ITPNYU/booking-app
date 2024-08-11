import { Check, Edit } from "@mui/icons-material";
import {
  FormControl,
  IconButton,
  InputAdornment,
  InputLabel,
  OutlinedInput,
  Typography,
} from "@mui/material";
import React, { useContext, useState } from "react";

import { DatabaseContext } from "../../../components/Provider";
import { updatePolicySettingData } from "@/components/src/server/admin";

export default function FinalApprover() {
  const { policySettings, reloadPolicySettings } = useContext(DatabaseContext);
  const [editing, setEditing] = useState(false);
  const [finalApproverEmail, setFinalApproverEmail] = useState(
    policySettings.finalApproverEmail
  );

  const handleOnChange = (e: any) => {
    setFinalApproverEmail(e.target.value);
  };

  const handleMouseDownEdit = (event: any) => {
    event.preventDefault();
  };

  const handleButtonClick = async () => {
    if (editing) {
      await updatePolicySettingData({ finalApproverEmail });
      await reloadPolicySettings();
    }
    setEditing((prev) => !prev);
  };

  return (
    <>
      <Typography variant="h6">Final Approver Email</Typography>
      <p>Set the recipient for final approval request emails</p>
      <FormControl sx={{ width: "40ch", marginTop: 2 }} variant="outlined">
        <InputLabel htmlFor="outlined-adornment-password">Email</InputLabel>
        <OutlinedInput
          id="outlined-adornment-password"
          disabled={!editing}
          value={finalApproverEmail}
          onChange={handleOnChange}
          label="Email"
          endAdornment={
            <InputAdornment position="end">
              <IconButton
                aria-label="toggle password visibility"
                onClick={handleButtonClick}
                onMouseDown={handleMouseDownEdit}
                edge="end"
              >
                {editing ? <Check /> : <Edit />}
              </IconButton>
            </InputAdornment>
          }
        />
      </FormControl>
    </>
  );
}
