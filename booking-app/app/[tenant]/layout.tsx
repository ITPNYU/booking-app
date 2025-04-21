"use client";

import React from "react";
import { notFound } from "next/navigation";
import {
  SchemaProvider,
  SchemaContextType,
} from "@/components/src/client/routes/components/SchemaProvider";

type LayoutProps = {
  children: React.ReactNode;
  params: {
    tenant: string;
  };
};

const ALLOWED_PLATFORMS = ["mc", "itp"];

const schema: Record<string, SchemaContextType> = {
  mc: {
    showNNumber: true,
    showSponsor: true,
    showHireSecurity: true,
    agreements: [
      {
        id: "checklist",
        html: `<p>
                I confirm receipt of the
                <a
                  href="https://docs.google.com/document/d/1TIOl8f8-7o2BdjHxHYIYELSb4oc8QZMj1aSfaENWjR8/edit#heading=h.ns3jisyhutvq"
                  target="_blank"
                  className="text-blue-600 hover:underline dark:text-blue-500 mx-1 mx-1"
                >
                  370J Media Commons Event Service Rates/Additional Information
                </a>
                document that contains information regarding event needs and
                services. I acknowledge that it is my responsibility to set up
                catering and Campus Media if needed for my reservation. I
                understand that the 370J Media Commons Operations staff will
                setup CBS cleaning services, facilitate hiring security, and
                arrange room setup services if needed for my reservation.
              </p>`,
      },
      {
        id: "resetRoom",
        html: `<p>
                I agree to reset all rooms and common spaces I have used to
                their original state at the end of my reservation, including
                returning equipment, resetting furniture, and cleaning up after
                myself. I will notify Media Commons staff of any problems,
                damage, or other concerns affecting the condition and
                maintenance of the reserved space. I understand that if I do not
                reset the room, I may lose access to the Media Commons.
              </p>`,
      },
      {
        id: "bookingPolicy",
        html: `<p>
                I have read the
                <a
                  href="https://docs.google.com/document/d/1vAajz6XRV0EUXaMrLivP_yDq_LyY43BvxOqlH-oNacc/edit"
                  target="_blank"
                  className="text-blue-600 hover:underline dark:text-blue-500 mx-1 mx-1"
                >
                  Booking Policy for 370J Media Commons
                </a>
                and agree to follow all policies outlined. I understand that I
                may lose access to the Media Commons if I break this agreement.
              </p>`,
      },
    ],
  },
  itp: {
    showNNumber: false,
    showSponsor: false,
    showHireSecurity: false,
    agreements: [
      {
        id: "bookingPolicy",
        html: `<p>placeholder</p>`,
      },
    ],
  },
};

const Layout: React.FC<LayoutProps> = ({ children, params }) => {
  if (!ALLOWED_PLATFORMS.includes(params.tenant)) {
    return notFound();
  }
  const tenantSchema = schema[params.tenant];
  return <SchemaProvider value={tenantSchema}>{children}</SchemaProvider>;
};

export default Layout;
