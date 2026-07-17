"use client";

import { usePathname } from "next/navigation";
import { AppHeader, type NavItem } from "@/components/app-header";
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
  const verified = status === "verified";
  const canRequestMoa = verified || status === "pending";
  const incomplete = status === "incomplete";

  const { data: invitesData } = useCompanyControllerListPendingInvites({
    query: {
      enabled: !!company && !incomplete,
      staleTime: 30_000,
    },
  });
  const pendingInviteCount = (invitesData?.invites ?? []).filter(
    (inv) => inv.university !== null,
  ).length;

  // Hide the app chrome on the unauthenticated pages.
  if (AUTH_SUFFIXES.some((s) => pathname.endsWith(s))) return null;

  // Partners and the request surface are hidden until the company has a complete profile.
  const nav: NavItem[] = [
    ...(!incomplete ? [{ href: "/dashboard", label: "Partners" }] : []),
    ...(canRequestMoa ? [{ href: "/universities", label: "Request MOA" }] : []),
    ...(pendingInviteCount > 0
      ? [{ href: "/invites", label: "Invitations", badge: pendingInviteCount }]
      : []),
  ];

  return (
    <AppHeader
      portal="Company"
      homeHref="/dashboard"
      nav={nav}
      userPrimary={company?.registered_name ?? undefined}
      userSecondary={company?.email ?? undefined}
      logout={companyAuthControllerLogout}
      postLogoutPath="/login"
      profileHref="/profile"
    />
  );
}
