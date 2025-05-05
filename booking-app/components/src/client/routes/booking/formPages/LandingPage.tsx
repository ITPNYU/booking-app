import { Box, Link, Typography } from "@mui/material";

import Button from "@mui/material/Button";
import React from "react";
import { styled } from "@mui/system";
import { useRouter } from "next/navigation";
import { useParams } from "next/navigation";
import { useTenantSchema } from "@/components/src/client/routes/components/SchemaProvider";

const Center = styled(Box)`
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
`;

const Modal = styled(Center)(({ theme }) => ({
  border: `1px solid ${theme.palette.custom.border}`,
  borderRadius: 4,
  alignItems: "flex-start",
  marginTop: 20,
  maxWidth: 800,
}));

const Title = styled(Typography)`
  font-weight: 700;
  font-size: 20px;
  line-height: 1.25;
  margin-bottom: 12px;
`;

export default function LandingPage() {
  const router = useRouter();
  const { tenant } = useParams();
  const schema = useTenantSchema();

  return (
    <Center
      sx={{ width: "100vw" }}
      height={{ xs: "unset", md: "90vh" }}
      padding={{ xs: 3 }}
    >
      <Title as="h1">{schema.nameForPolicy} Reservation Form</Title>
      <p>Thank you for your interest in booking with the {schema.name}</p>
      <Modal padding={4}>
        <Typography
          sx={{ fontWeight: 500, fontSize: "1rem", lineHeight: "1.5" }}
        >
          Please read our policy for using the {schema.nameForPolicy}
        </Typography>
        <div dangerouslySetInnerHTML={{ __html: schema.policy }} />
        <Button
          variant="contained"
          color="primary"
          onClick={() => router.push(`/${tenant}/book/role`)}
          sx={{
            alignSelf: "center",
            marginTop: 6,
          }}
        >
          I accept
        </Button>
      </Modal>
    </Center>
  );
}
