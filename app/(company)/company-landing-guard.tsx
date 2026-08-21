"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  useCompanyProfile,
  useCompanyVerification,
} from "@/app/providers/company-profile.provider";

// While a required document is missing, every route funnels back to the
// documents page except the three the company can still freely browse
// (flow spec §2, plan §7.1). Matched by suffix, not full path — subdomain
// routing drops the /company prefix (see company-header.tsx's own note).
const EXEMPT_SUFFIXES = [
  "/dashboard",
  "/invites",
  "/profile",
  "/invite/continue",
];

export function CompanyLandingGuard() {
  const pathname = usePathname() ?? "";
  const router = useRouter();
  const { company } = useCompanyProfile();
  const { data: verification } = useCompanyVerification(!!company);

  useEffect(() => {
    if (verification?.status !== "incomplete") return;
    if (EXEMPT_SUFFIXES.some((suffix) => pathname.endsWith(suffix))) return;
    router.replace("/profile#documents");
  }, [pathname, router, verification?.status]);

  return null;
}
