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
  const verified = verification?.status === "verified";

  // Hide the app chrome on the unauthenticated pages.
  if (AUTH_SUFFIXES.some((s) => pathname.endsWith(s))) return null;

  // The request surface is hidden globally until the company is verified.
  const nav: NavItem[] = [
    { href: "/dashboard", label: "Active MOAs" },
    ...(verified ? [{ href: "/universities", label: "Request MOA" }] : []),
    { href: "/profile", label: "Profile" },
  ];

  return (
    <AppHeader
      portal="Company"
      homeHref="/dashboard"
      nav={nav}
      userPrimary={company?.display_name ?? undefined}
      userSecondary={company?.rep_email ?? undefined}
      logoutPath="/api/auth/company/logout"
      postLogoutPath="/login"
    />
  );
}
