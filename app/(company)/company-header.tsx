"use client";

import { usePathname } from "next/navigation";
import { AppHeader, type NavItem } from "@/components/app-header";
import { CompanyProfileStatusNotice } from "@/components/company/company-profile-status-notice";
import {
  useCompanyProfile,
  useCompanyVerification,
} from "@/app/providers/company-profile.provider";
import {
  companyAuthControllerLogout,
  useCompanyControllerListPendingInvites,
} from "@/app/api";

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
  const canRequestMoa = !!status;
  const canViewInvites = !!status;

  const { data: invitesData } = useCompanyControllerListPendingInvites({
    query: {
      enabled: !!company && canViewInvites,
      staleTime: 30_000,
    },
  });
  const pendingInviteCount = (invitesData?.invites ?? []).filter(
    (inv) => inv.university !== null,
  ).length;

  // Hide the app chrome on the unauthenticated pages.
  if (AUTH_SUFFIXES.some((s) => pathname.endsWith(s))) return null;

  const nav: NavItem[] = [
    ...(status ? [{ href: "/dashboard", label: "Partners" }] : []),
    ...(canRequestMoa ? [{ href: "/universities", label: "Request MOA" }] : []),
    ...(canViewInvites && pendingInviteCount > 0
      ? [{ href: "/invites", label: "Invitations", badge: pendingInviteCount }]
      : []),
  ];

  return (
    <>
      <AppHeader
        portal="Company"
        homeHref="/dashboard"
        nav={nav}
        userPrimary={company?.registered_name ?? undefined}
        userSecondary={company?.email ?? undefined}
        logout={companyAuthControllerLogout}
        postLogoutPath="/login"
        profileHref={status === "incomplete" ? "/complete-profile" : "/profile"}
      />
      {status === "expired" && (
        <CompanyProfileStatusNotice status="expired" compactAttention />
      )}
    </>
  );
}
