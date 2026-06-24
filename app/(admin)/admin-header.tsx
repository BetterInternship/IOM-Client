"use client";

import { usePathname } from "next/navigation";
import { AppHeader } from "@/components/app-header";

export function AdminHeader() {
  const pathname = usePathname() ?? "";

  // Hide the app chrome on the login page.
  if (pathname.endsWith("/login")) return null;

  return (
    <AppHeader
      portal="Platform Admin"
      homeHref="/universities"
      nav={[
        { href: "/universities", label: "Universities" },
        { href: "/templates", label: "MOA Templates" },
        { href: "/reviews", label: "Company Reviews" },
      ]}
      userPrimary="Administrator"
      logoutPath="/api/auth/admin/logout"
      postLogoutPath="/login"
    />
  );
}
