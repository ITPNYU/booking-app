import { Box, Typography, useMediaQuery, useTheme } from "@mui/material";

import Image from "next/image";
import { PagePermission } from "@/components/src/types";
import React from "react";
import SVGLOGO from "../../../../../../public/mediaCommonsLogo.svg";
import { styled } from "@mui/system";
import { useRouter } from "next/navigation";

const Title = styled(Typography)`
  width: fit-content;
  font-size: 20px;
  font-weight: 500;
`;

const LogoBox = styled(Box)`
  cursor: pointer;
  display: flex;
  align-items: flex-end;

  img {
    margin-right: 8px;
  }
`;

interface Props {
  setSelectedView: (x: PagePermission) => void;
}

export default function NavBarTitle({ setSelectedView }: Props) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const router = useRouter();

  const handleClickHome = () => {
    setSelectedView(PagePermission.BOOKING);
    router.push("/");
  };

  const envTitle = (() => {
    const branch = process.env.NEXT_PUBLIC_BRANCH_NAME;
    if (branch.toLowerCase() === "production") {
      return "";
    }
    const branchTitle = branch.charAt(0).toUpperCase() + branch.slice(1);
    return `[${branchTitle}]`;
  })();

  return (
    <LogoBox onClick={handleClickHome}>
      <Image src={SVGLOGO} alt="Media Commons logo" height={40} />
      {!isMobile && <Title as="h1">Media Commons {envTitle}</Title>}
    </LogoBox>
  );
}
