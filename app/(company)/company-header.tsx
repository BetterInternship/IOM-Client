"use client";

import { usePathname } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { AppHeader, type NavItem } from "@/components/app-header";
import {
  useCompanyProfile,
  useCompanyVerification,
} from "@/app/providers/company-profile.provider";
import { preconfiguredAxios } from "@/app/api/preconfig.axios";

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

  const { data: invitesData } = useQuery({
    queryKey: ["company-pending-invites"],
    queryFn: () =>
      preconfiguredAxios
        .get("/api/company/invites/pending")
        .then((r) => r.data as { invites: Array<{ id: string; university: { id: string } | null }> }),
    enabled: !!company && !incomplete,
    staleTime: 30_000,
  });
  const pendingInviteCount = (invitesData?.invites ?? []).filter((inv) => inv.university !== null).length;

  // Hide the app chrome on the unauthenticated pages.
  if (AUTH_SUFFIXES.some((s) => pathname.endsWith(s))) return null;

  // Partners and the request surface are hidden until the company has a complete profile.
  const nav: NavItem[] = [
    ...(!incomplete ? [{ href: "/dashboard", label: "Partners" }] : []),
    ...(verified ? [{ href: "/universities", label: "Request MOA" }] : []),
    ...(pendingInviteCount > 0 ? [{ href: "/invites", label: "Invitations", badge: pendingInviteCount }] : []),
  ];

  return (
    <AppHeader
      portal="Company"
      homeHref="/dashboard"
      nav={nav}
      userPrimary={company?.registered_name ?? undefined}
      userSecondary={company?.email ?? undefined}
      logoutPath="/api/auth/company/logout"
      postLogoutPath="/login"
      profileHref="/profile"
    />
  );
}
