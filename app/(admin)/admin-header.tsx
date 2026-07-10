"use client";

import { usePathname } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import { adminAuthControllerLogout, useAdminControllerOverview } from "@/app/api";

export function AdminHeader() {
  const pathname = usePathname() ?? "";

  const { data: overview } = useAdminControllerOverview({
    query: {
      staleTime: Infinity,
      retry: false,
    },
  });
  const pendingReviewCount = overview?.pendingReviewCount ?? 0;

  // Hide the app chrome on the login page.
  if (pathname.endsWith("/login")) return null;

  return (
    <AppHeader
      portal="Platform Admin"
      homeHref="/universities"
      nav={[
        { href: "/universities", label: "Universities" },
        { href: "/companies", label: "Companies" },
        { href: "/templates", label: "MOA Templates" },
        ...(pendingReviewCount > 0 ? [{ href: "/reviews", label: "Company Reviews", badge: pendingReviewCount }] : []),
      ]}
      userPrimary="Administrator"
      logout={adminAuthControllerLogout}
      postLogoutPath="/login"
    />
  );
}
