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

  // Three fixed tabs always (flow spec §2) — no status-derived gating.
  const { data: invitesData } = useCompanyControllerListPendingInvites({
    query: { enabled: !!company, staleTime: 30_000 },
  });
  const pendingInviteCount = (invitesData?.invites ?? []).filter(
    (inv) => inv.university !== null,
  ).length;

  // Hide the app chrome on the unauthenticated pages.
  if (AUTH_SUFFIXES.some((s) => pathname.endsWith(s))) return null;

  // The verification page IS the "go fix your documents" destination this
  // notice would send you to — showing it there is a CTA to the page you're
  // already on.
  const onVerificationPage = pathname.endsWith("/verification");

  // Incomplete companies can't have any requests in flight yet (the
  // dashboard's request CTA is locked until verification), and the landing
  // guard bounces /requests back to /verification anyway — so don't
  // surface a nav item that always redirects away.
  const nav: NavItem[] = [
    { href: "/dashboard", label: "Partners" },
    ...(status === "incomplete"
      ? []
      : [{ href: "/requests", label: "MOA Requests" }]),
    {
      href: "/invites",
      label: "Invites",
      ...(pendingInviteCount > 0 ? { badge: pendingInviteCount } : {}),
    },
  ];

  return (
    <>
      <AppHeader
        portal="Company"
        homeHref="/dashboard"
        nav={nav}
        // Identity before approval is the account email (flow spec §3).
        userPrimary={company?.registered_name ?? company?.email ?? undefined}
        userSecondary={company?.email ?? undefined}
        logout={companyAuthControllerLogout}
        postLogoutPath="/login"
        profileHref="/profile"
      />
      {status === "incomplete" && !onVerificationPage && (
        // Flush edge-to-edge under the header — the notice's own rounded
        // corners (meant for a notice sitting inside a padded page) look
        // wrong here, so they're stripped via its data-slot.
        <div className="[&>[data-slot=status-notice]]:rounded-none">
          <CompanyProfileStatusNotice
            status="incomplete"
            reason={verification?.reason}
            documentRejections={verification?.documentRejections}
            expiredDocument={verification?.expiredDocument}
            compactAttention
          />
        </div>
      )}
    </>
  );
}
