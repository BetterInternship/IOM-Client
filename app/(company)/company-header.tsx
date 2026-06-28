"use client";

import { usePathname } from "next/navigation";
import { AppHeader, type NavItem } from "@/components/app-header";
import {
  useCompanyProfile,
  useCompanyVerification,
} from "@/app/providers/company-profile.provider";

const AUTH_SUFFIXES = [
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
];

export function CompanyHeader() {
  const pathname = usePathname() ?? "";
  const { company } = useCompanyProfile();
  const { data: verification } = useCompanyVerification(!!company);
  const status = verification?.status;
  const verified = status === "verified";
  const incomplete = status === "incomplete";

  // Hide the app chrome on the unauthenticated pages.
  if (AUTH_SUFFIXES.some((s) => pathname.endsWith(s))) return null;

  // Partners and the request surface are hidden until the company has a complete profile.
  const nav: NavItem[] = [
    ...(!incomplete ? [{ href: "/dashboard", label: "Partners" }] : []),
    ...(verified ? [{ href: "/universities", label: "Request MOA" }] : []),
    { href: "/profile", label: "Profile" },
  ];

  return (
    <AppHeader
      portal="Company"
      homeHref="/dashboard"
      nav={nav}
      userPrimary={company?.display_name ?? undefined}
      userSecondary={company?.email ?? undefined}
      logoutPath="/api/auth/company/logout"
      postLogoutPath="/login"
    />
  );
}
