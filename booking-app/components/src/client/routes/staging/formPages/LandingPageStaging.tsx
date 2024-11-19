import { Box, Typography } from "@mui/material";

import Button from "@mui/material/Button";
import { styled } from "@mui/system";
import { useRouter } from "next/navigation";

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

export default function LandingPageStaging() {
  const router = useRouter();

  return (
    <Center
      sx={{ width: "100vw" }}
      height={{ xs: "unset", md: "70vh" }}
      padding={{ xs: 3 }}
    >
      <Title as="h1">ITP/IMA Staging Space Request Form</Title>
      <Modal padding={4}>
        <Typography fontWeight={500}>
          Please read our policy for requesting Staging Space
        </Typography>
        <Typography fontWeight={700} marginTop={3}>
          What is Staging?
        </Typography>
        <p>
          “Staging” is the temporary assignment of dedicated work space,
          assigned in 2 week blocks, to install a project, work on an intensive
          build, conduct user testing over time, demo a project and most
          importantly — to build out the functionality of your project.
        </p>
        <br />
        <p>
          For more information,{" "}
          <a
            href="https://itp.nyu.edu/help/staging-space/"
            target="_blank"
            rel="noopener noreferrer"
          >
            visit the ITP/IMA Help page.
          </a>
        </p>
        <Button
          variant="contained"
          color="primary"
          onClick={() => router.push("/staging/book/start-date")}
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
