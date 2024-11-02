import { Box, Typography, useMediaQuery, useTheme } from "@mui/material";

import ITPLogo from "../../../../../../public/itpLogo.svg";
import Image from "next/image";
import MediaCommonsLogo from "../../../../../../public/mediaCommonsLogo.svg";
import { PagePermission } from "@/components/src/types";
import React from "react";
import { Tenants } from "@/components/src/policy";
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
  tenant: Tenants;
}

export default function NavBarTitle({ setSelectedView, tenant }: Props) {
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

  const title = (() => {
    switch (tenant) {
      case Tenants.MEDIA_COMMONS:
        return "Media Commons";
      case Tenants.STAGING:
        return "Staging Space";
      default:
        return "Booking Tool";
    }
  })();

  const logo = (() => {
    switch (tenant) {
      case Tenants.MEDIA_COMMONS:
        return MediaCommonsLogo;
      case Tenants.STAGING:
        return ITPLogo;
      default:
        return ITPLogo;
    }
  })();

  return (
    <LogoBox onClick={handleClickHome}>
      <Image src={logo} alt="logo" height={40} />
      {!isMobile && (
        <Title as="h1">
          {title} {envTitle}
        </Title>
      )}
    </LogoBox>
  );
}
