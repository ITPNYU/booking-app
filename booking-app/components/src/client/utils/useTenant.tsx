import { Tenants } from "../../policy";

import { usePathname } from "next/navigation";

export default function useTenant(): Tenants {
  const pathname = usePathname();

  if (pathname.includes("/staging")) {
    return Tenants.STAGING;
  } else if (pathname.includes("/media-commons")) {
    return Tenants.MEDIA_COMMONS;
  }
  return null;
}
