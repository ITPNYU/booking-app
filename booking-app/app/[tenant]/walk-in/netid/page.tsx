"use client";

import { Box, Button, Typography, Alert } from "@mui/material";
import { styled } from "@mui/material/styles";
import { useRouter, useParams } from "next/navigation";
import { useContext, useState } from "react";
import { useForm } from "react-hook-form";
import { BookingContext } from "@/components/src/client/routes/booking/bookingProvider";
import { BookingFormTextField } from "@/components/src/client/routes/booking/components/BookingFormInputs";
import { Inputs } from "@/components/src/types";

const Center = styled(Box)`
  width: 100%;
  height: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
`;

const Container = styled(Box)(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  borderRadius: "4px",
  border: `1px solid ${theme.palette.divider}`,
}));

export default function WalkInNetIdPage() {
  const { formData, setFormData } = useContext(BookingContext);
  const router = useRouter();
  const { tenant } = useParams();
  const [error, setError] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    formState: { errors },
    trigger,
  } = useForm<Inputs>({
    defaultValues: {
      ...formData,
      walkInNetId: formData?.walkInNetId || "",
    },
    mode: "onBlur",
  });

  const onSubmit = (data: Inputs) => {
    const netId = (data.walkInNetId || "").trim().toLowerCase();
    
    // Basic validation
    if (!netId) {
      setError("Please enter a NetID");
      return;
    }
    
    // Check if it looks like a valid NetID (alphanumeric, no @ symbol)
    if (netId.includes("@")) {
      setError("Please enter only the NetID without @nyu.edu");
      return;
    }

    // Store the walkInNetId in formData
    setFormData({
      ...formData,
      walkInNetId: netId,
      // Also set netId for compatibility with existing code
      netId: netId,
    } as any);

    // Navigate to role page
    router.push(`/${tenant}/walk-in/role`);
  };

  return (
    <Center>
      <Container
        padding={4}
        margin={3}
        marginTop={6}
        width={{ xs: "100%", md: "50%" }}
      >
        <Typography fontWeight={500} marginBottom={2} variant="h6">
          Walk-In Visitor Information
        </Typography>
        
        <Typography variant="body2" color="text.secondary" marginBottom={3} textAlign="center">
          Enter the NetID of the person using the space (not the PA making the booking)
        </Typography>

        {error && (
          <Alert severity="error" sx={{ marginBottom: 2, width: "100%" }}>
            {error}
          </Alert>
        )}

        <form onSubmit={handleSubmit(onSubmit)} style={{ width: "100%" }}>
          <BookingFormTextField
            id="walkInNetId"
            label="Walk-In NetID"
            containerSx={{ marginBottom: 2, width: "100%" }}
            fieldSx={{}}
            control={control}
            errors={errors}
            trigger={trigger}
            required={true}
            pattern={{
              value: /^[a-zA-Z0-9]+$/,
              message: "NetID should only contain letters and numbers",
            }}
          />
          
          <Button
            type="submit"
            variant="contained"
            color="primary"
            fullWidth
            sx={{ marginTop: 2 }}
          >
            Next
          </Button>
        </form>
      </Container>
    </Center>
  );
}

