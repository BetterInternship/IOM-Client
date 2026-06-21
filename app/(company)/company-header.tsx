"use client";

import { usePathname } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import { useCompanyProfile } from "@/app/providers/company-profile.provider";

const AUTH_SUFFIXES = [
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
];

export function CompanyHeader() {
  const pathname = usePathname() ?? "";
  const { company } = useCompanyProfile();

  // Hide the app chrome on the unauthenticated pages.
  if (AUTH_SUFFIXES.some((s) => pathname.endsWith(s))) return null;

  return (
    <AppHeader
      portal="Company"
      homeHref="/dashboard"
      nav={[
        { href: "/dashboard", label: "Active MOAs" },
        { href: "/universities", label: "Request MOA" },
        { href: "/profile", label: "Profile" },
      ]}
      userPrimary={company?.display_name ?? undefined}
      userSecondary={company?.rep_email ?? undefined}
      logoutPath="/api/auth/company/logout"
      postLogoutPath="/login"
    />
  );
}
