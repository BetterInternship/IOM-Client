"use client";

import { usePathname } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { AppHeader } from "@/components/app-header";
import { preconfiguredAxios } from "@/app/api/preconfig.axios";

export function AdminHeader() {
  const pathname = usePathname() ?? "";

  const { data: overview } = useQuery({
    queryKey: ["admin-me"],
    queryFn: () => preconfiguredAxios.get("/api/admin/overview").then((r) => r.data),
    staleTime: Infinity,
    retry: false,
  });
  const pendingReviewCount = (overview as { pendingReviewCount?: number })?.pendingReviewCount ?? 0;

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
      logoutPath="/api/auth/admin/logout"
      postLogoutPath="/login"
    />
  );
}
