import { Alert, Box, CircularProgress, Typography } from "@mui/material";

import { useTenantSchema } from "@/components/src/client/routes/components/SchemaProvider";
import Button from "@mui/material/Button";
import { styled } from "@mui/system";
import { useParams, useRouter } from "next/navigation";
import { useContext, useState } from "react";
import { DatabaseContext } from "../../components/Provider";

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
  const { maintenanceMode, permissionsLoading } = useContext(DatabaseContext);
  const [isLoading, setIsLoading] = useState(false);

  const handleAccept = () => {
    setIsLoading(true);
    router.push(`/${tenant}/book/role`);
  };

  return (
    <Center
      sx={{ width: "100vw" }}
      height={{ xs: "unset" }}
      padding={{ xs: 3 }}
    >
      <Title as="h1">{schema.tenant.nameForPolicy} Reservation Form</Title>
      <p>
        Thank you for your interest in booking with the {schema.tenant.name}
      </p>
      {!permissionsLoading && maintenanceMode.enabled ? (
        <Modal padding={4}>
          <Alert severity="warning" sx={{ width: "100%" }}>
            <Typography sx={{ whiteSpace: "pre-wrap" }}>
              {maintenanceMode.message}
            </Typography>
          </Alert>
        </Modal>
      ) : (
        <Modal padding={4}>
          <Typography
            sx={{ fontWeight: 500, fontSize: "1rem", lineHeight: "1.5" }}
          >
            Please read our policy for using the {schema.tenant.nameForPolicy}
          </Typography>
          <div dangerouslySetInnerHTML={{ __html: schema.policy }} />
          <Button
            variant="contained"
            color="primary"
            onClick={handleAccept}
            disabled={isLoading || permissionsLoading}
            sx={{
              alignSelf: "center",
              marginTop: 6,
            }}
          >
            {isLoading ? (
              <>
                <CircularProgress size={20} sx={{ mr: 1, color: "white" }} />
                Loading...
              </>
            ) : (
              "I accept"
            )}
          </Button>
        </Modal>
      )}
    </Center>
  );
}
