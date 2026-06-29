"use client";

import { usePathname } from "next/navigation";
import { AppHeader, type NavItem } from "@/components/app-header";
import { useUniversityProfile } from "@/app/providers/university-profile.provider";

const AUTH_SUFFIXES = [
  "/login",
  "/accept-invite",
  "/forgot-password",
  "/reset-password",
];

export function UniversityHeader() {
  const pathname = usePathname() ?? "";
  const { account, isSuperadmin } = useUniversityProfile();

  if (AUTH_SUFFIXES.some((s) => pathname.endsWith(s))) return null;

  const nav: NavItem[] = [
    { href: "/partners", label: "Partners" },
    ...(isSuperadmin
      ? [{ href: "/accounts", label: "Accounts" }]
      : []),
    { href: "/activity-log", label: "Activity Log" },
    ...(isSuperadmin
      ? [{ href: "/templates", label: "MOA Templates" }]
      : []),
  ];

  return (
    <AppHeader
      portal="University"
      homeHref="/partners"
      nav={nav}
      userPrimary={account?.display_name ?? account?.university.registered_name}
      userSecondary={account?.email}
      logoutPath="/api/auth/university/logout"
      postLogoutPath="/login"
      profileHref="/profile"
      userAvatarUrl={account?.university.logo_url}
    />
  );
}
