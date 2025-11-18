"use client";

import { Box, Button, Typography, Alert } from "@mui/material";
import { styled } from "@mui/material/styles";
import { useRouter, useParams } from "next/navigation";
import { useContext, useState, useMemo } from "react";
import { useForm } from "react-hook-form";
import { BookingContext } from "@/components/src/client/routes/booking/bookingProvider";
import { DatabaseContext } from "@/components/src/client/routes/components/Provider";
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
  const { userEmail } = useContext(DatabaseContext);
  const router = useRouter();
  const { tenant } = useParams();
  const [error, setError] = useState<string | null>(null);

  // Extract requester's netID from email (e.g., "abc123@nyu.edu" -> "abc123")
  const requesterNetId = useMemo(() => {
    if (!userEmail) return null;
    return userEmail.split("@")[0].toLowerCase();
  }, [userEmail]);

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

    // Validate that the visitor's NetID is not the same as the requester's NetID
    if (requesterNetId && netId === requesterNetId) {
      setError("The visitor's NetID cannot be the same as the requester's NetID");
      return;
    }

    // Store the walkInNetId in formData
    setFormData({
      ...formData,
      walkInNetId: netId,
      // netId is intentionally not set here; for walk-in bookings, walkInNetId represents the visitor's NetID.
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
          Walk-In NetID
        </Typography>

        <Typography variant="body2" color="text.secondary" marginBottom={3} textAlign="center">
          Enter the NetID of the visitor using the space (not the requester's NetID)
        </Typography>

        {error && (
          <Alert severity="error" sx={{ marginBottom: 2, width: "100%" }}>
            {error}
          </Alert>
        )}

        <form
          onSubmit={handleSubmit(onSubmit)}
          style={{
            width: "100%",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
          }}
        >
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
            validate={(value) => {
              if (!value) return true; // Required validation is handled separately
              const enteredNetId = value.trim().toLowerCase();
              if (requesterNetId && enteredNetId === requesterNetId) {
                return "The visitor's NetID cannot be the same as the requester's NetID";
              }
              return true;
            }}
          />

          <Button
            type="submit"
            variant="contained"
            color="primary"
            sx={{ marginTop: 2 }}
          >
            Next
          </Button>
        </form>
      </Container>
    </Center>
  );
}
